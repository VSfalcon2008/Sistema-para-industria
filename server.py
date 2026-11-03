"""Servidor local de demonstração para o protótipo Indústria One."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import secrets
import hashlib
import hmac
import os

ROOT = Path(__file__).resolve().parent
DATA_FILE = Path(os.environ.get("DATA_FILE", ROOT / "shared-data.json"))
SESSIONS = {}
DEMO_BOSS_PASSWORD = os.environ.get("BOSS_PASSWORD", "123456")
USERS = {
    "chefe": {"password": DEMO_BOSS_PASSWORD, "name": "Mariana Costa", "role": "chefe"},
    "empregado": {"password": "123456", "name": "Colaborador", "role": "empregado"},
}


def read_data():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return {"basic": [], "financial": [], "users": {}, "registration_requests": []}


def write_data(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp = DATA_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, DATA_FILE)
DASHBOARD = {
    "revenue": "R$ 2.840.500",
    "net_profit": 684230,
    "open_orders": 1284,
    "production_efficiency": 87.6,
    "low_stock": [{"item": "Aço carbono 1020", "quantity": 120, "unit": "kg", "minimum": 200}],
    "production": {"month_total": 24680, "monthly_goal": 28000, "lines": {"A": 8420, "B": 6180, "C": 9240, "D": 4120}},
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def current_user(self):
        cookie = self.headers.get("Cookie", "")
        for part in cookie.split(";"):
            key, _, value = part.strip().partition("=")
            if key == "session":
                return SESSIONS.get(value)
        return None

    def read_request(self):
        size = min(int(self.headers.get("Content-Length", "0")), 100_000)
        return json.loads(self.rfile.read(size) or b"{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/me":
            user = self.current_user()
            return self.send_json({"user": user})
        if path == "/api/data":
            data = read_data()
            data.pop("users", None)
            user = self.current_user()
            if not user or user.get("role") != "chefe":
                data.pop("registration_requests", None)
            else:
                data["registration_requests"] = [
                    {key: request.get(key) for key in ("id", "name", "username", "created_at", "status")}
                    for request in data.get("registration_requests", [])
                ]
            return self.send_json(data)
        if path == "/api/dashboard":
            return self.send_json(DASHBOARD)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/login":
            try:
                payload = self.read_request()
                username = str(payload.get("username", "")).strip().lower()
                password = str(payload.get("password", ""))
            except (ValueError, json.JSONDecodeError):
                return self.send_json({"error": "Requisição inválida"}, 400)
            account = USERS.get(username) or read_data().get("users", {}).get(username)
            valid = bool(account and (
                hmac.compare_digest(password, account["password"]) if "password" in account
                else hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(account["salt"]), 180_000).hex(), account["password_hash"])
            ))
            if not valid:
                return self.send_json({"error": "Usuário ou senha inválidos"}, 401)
            token = secrets.token_urlsafe(32)
            user = {"username": username, "name": account["name"], "role": account["role"]}
            SESSIONS[token] = user
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"session={token}; HttpOnly; SameSite=Strict; Path=/")
            body = json.dumps({"user": user}, ensure_ascii=False).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/api/register":
            try:
                payload = self.read_request()
                name = str(payload.get("name", "")).strip()[:100]
                username = str(payload.get("username", "")).strip().lower()[:30]
                password = str(payload.get("password", ""))
            except (ValueError, json.JSONDecodeError):
                return self.send_json({"error": "Requisição inválida"}, 400)
            if len(name) < 2 or len(username) < 3 or not username.replace("_", "").replace("-", "").isalnum() or len(password) < 8:
                return self.send_json({"error": "Informe nome, usuário válido e senha com pelo menos 8 caracteres."}, 400)
            data = read_data()
            if username in USERS or username in data.get("users", {}) or any(r["username"] == username for r in data.get("registration_requests", [])):
                return self.send_json({"error": "Esse nome de usuário já está em uso ou aguarda aprovação."}, 409)
            salt = secrets.token_bytes(16)
            request = {"id": secrets.token_hex(8), "name": name, "username": username,
                       "salt": salt.hex(), "password_hash": hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 180_000).hex(),
                       "created_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"), "status": "pendente"}
            data.setdefault("registration_requests", []).insert(0, request)
            write_data(data)
            return self.send_json({"ok": True, "message": "Solicitação enviada ao chefe para aprovação."}, 201)
        if path == "/api/users/authorize":
            user = self.current_user()
            if not user or user.get("role") != "chefe":
                return self.send_json({"error": "Somente o chefe pode autorizar novos usuários."}, 403)
            try:
                payload = self.read_request()
                request_id = str(payload.get("id", ""))
                action = str(payload.get("action", ""))
            except (ValueError, json.JSONDecodeError):
                return self.send_json({"error": "Requisição inválida"}, 400)
            if action not in {"aprovar", "recusar"}:
                return self.send_json({"error": "Ação inválida"}, 400)
            data = read_data()
            request = next((r for r in data.get("registration_requests", []) if r["id"] == request_id), None)
            if not request:
                return self.send_json({"error": "Solicitação não encontrada"}, 404)
            data["registration_requests"] = [r for r in data.get("registration_requests", []) if r["id"] != request_id]
            if action == "aprovar":
                data.setdefault("users", {})[request["username"]] = {
                    "name": request["name"], "role": "empregado", "salt": request["salt"],
                    "password_hash": request["password_hash"]
                }
            write_data(data)
            return self.send_json({"ok": True, "message": "Usuário aprovado." if action == "aprovar" else "Solicitação recusada."})
        if path == "/api/logout":
            user = self.current_user()
            cookie = self.headers.get("Cookie", "")
            for part in cookie.split(";"):
                key, _, value = part.strip().partition("=")
                if key == "session":
                    SESSIONS.pop(value, None)
            return self.send_json({"ok": True})
        if path in ("/api/basic", "/api/financial"):
            user = self.current_user()
            if not user:
                return self.send_json({"error": "Autenticação necessária"}, 401)
            if path == "/api/financial" and user["role"] != "chefe":
                return self.send_json({"error": "Apenas usuários chefe podem registrar informações financeiras"}, 403)
            try:
                payload = self.read_request()
                allowed = {"date", "title", "description", "value", "category", "module"} if path.endswith("financial") else {"date", "title", "description", "department", "module"}
                entry = {key: str(payload.get(key, "")).strip()[:500] for key in allowed}
                if not entry.get("title"):
                    return self.send_json({"error": "Informe um título"}, 400)
                if entry.get("module") not in {"financeiro", "vendas", "estoque", "compras", "producao", "pessoas", "qualidade", "relatorios", "configuracoes"}:
                    return self.send_json({"error": "Módulo inválido"}, 400)
                if path.endswith("financial"):
                    if entry.get("category") not in {"Receita", "Despesa"}:
                        return self.send_json({"error": "Tipo financeiro inválido"}, 400)
                    try:
                        if float(entry.get("value", "0")) <= 0:
                            raise ValueError
                    except ValueError:
                        return self.send_json({"error": "Informe um valor válido"}, 400)
                entry.update({"id": secrets.token_hex(6), "author": user["name"], "created_at": __import__("datetime").datetime.now().isoformat(timespec="seconds")})
                data = read_data()
                data["financial" if path.endswith("financial") else "basic"].insert(0, entry)
                write_data(data)
                return self.send_json({"ok": True, "entry": entry}, 201)
            except (ValueError, json.JSONDecodeError, OSError):
                return self.send_json({"error": "Não foi possível salvar o registro"}, 400)
        if path != "/api/assistant":
            return self.send_json({"error": "Rota não encontrada"}, 404)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(size) or b"{}")
            question = str(request.get("question", "")).strip().lower()
        except (ValueError, json.JSONDecodeError):
            return self.send_json({"error": "Requisição inválida"}, 400)

        if any(word in question for word in ("estoque", "material", "acab", "mínimo", "minimo")):
            answer = ("Alerta de estoque: o Aço carbono 1020 está com 120 kg disponíveis, "
                      "abaixo do mínimo configurado de 200 kg. Recomendo abrir uma solicitação de compra. "
                      "Esta resposta usa os dados de demonstração do protótipo.")
        elif any(word in question for word in ("produção", "producao", "eficiência", "eficiencia", "produtividade")):
            answer = ("A eficiência produtiva registrada é de 87,6%, com queda de 2,1% em relação ao período anterior. "
                      "Foram produzidas 24.680 unidades no mês, frente à meta de 28.000. "
                      "Estes são dados demonstrativos.")
        elif any(word in question for word in ("fatur", "receita", "vendeu", "vendas")):
            answer = ("O faturamento demonstrativo do período é de R$ 2.840.500, 12,8% acima do período anterior. "
                      "Consulte o módulo Financeiro para detalhar receitas e lançamentos.")
        elif any(word in question for word in ("lucro", "margem", "rentabilidade")):
            answer = ("O lucro líquido demonstrativo é de R$ 684.230, com alta de 8,4% frente ao período anterior. "
                      "Os valores são ilustrativos e devem ser substituídos pelos dados reais da empresa.")
        else:
            answer = ("Posso ajudar com faturamento, lucro, produção e materiais abaixo do estoque mínimo. "
                      "As respostas atuais usam apenas dados demonstrativos deste protótipo.")
        return self.send_json({"answer": answer, "source": "demo"})

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    address = ("0.0.0.0", int(os.environ.get("PORT", "8000")))
    print(f"Indústria One disponível em http://{address[0]}:{address[1]}")
    print("Pressione Ctrl+C para encerrar.")
    ThreadingHTTPServer(address, Handler).serve_forever()
