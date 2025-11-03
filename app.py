from flask import Flask, request, jsonify
from flask_cors import CORS
from pyairtable import Table
import jwt, os, datetime

# --- Configuração base ---
app = Flask(__name__)
CORS(app)

# Variáveis de ambiente
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")
AIRTABLE_TABLE_NAME = os.getenv("AIRTABLE_TABLE_NAME", "Acessos")
JWT_SECRET = os.getenv("JWT_SECRET", "seu_token_seguro")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin")

table = Table(AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)

# --- Endpoint de teste ---
@app.route("/api")
def api_status():
    return jsonify({"message": "API Flask do Portal de Acessos online! 🔥"})

# --- Login Admin ---
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data: return jsonify({"message": "Requisição inválida."}), 400

    username = data.get("username")
    password = data.get("password")

    if username == ADMIN_USER and password == ADMIN_PASS:
        token = jwt.encode(
            {
                "user": username,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
            },
            JWT_SECRET,
            algorithm="HS256"
        )
        return jsonify({"token": token})
    return jsonify({"message": "Credenciais inválidas."}), 401

# --- Consulta de Agente ---
@app.route("/api/getAgent", methods=["GET"])
def get_agent():
    ramal = request.args.get("ramal")
    if not ramal:
        return jsonify({"message": "Número do Ramal não fornecido."}), 400

    records = table.all(formula=f"{{Ramal}} = '{ramal}'")
    if not records:
        return jsonify({"message": "Ramal não encontrado."}), 404

    return jsonify(records[0]["fields"])

# --- Adicionar novo Agente ---
@app.route("/api/addAgent", methods=["POST"])
def add_agent():
    auth = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not auth:
        return jsonify({"message": "Token não fornecido."}), 401

    try:
        jwt.decode(auth, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Token expirado."}), 403
    except jwt.InvalidTokenError:
        return jsonify({"message": "Token inválido."}), 403

    new_agent = request.get_json()
    if not new_agent or "Ramal" not in new_agent:
        return jsonify({"message": "Dados incompletos."}), 400

    existing = table.all(formula=f"{{Ramal}} = '{new_agent['Ramal']}'")
    if existing:
        return jsonify({"message": "Ramal já cadastrado."}), 409

    table.create(new_agent)
    return jsonify({"message": f"Agente (Ramal {new_agent['Ramal']}) criado com sucesso."}), 201

# --- Inicialização ---
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8080)))
