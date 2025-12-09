const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("./db");

module.exports = {

    // Registro
    register: async (req, res) => {
        try {
            const { name, email, password } = req.body;

            const hashedPassword = await bcrypt.hash(password, 10);

            const result = await pool.query(
                "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
                [name, email, hashedPassword]
            );

            res.json({
                message: "Usuário registrado com sucesso!",
                user: result.rows[0]
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Erro ao registrar usuário" });
        }
    },

    // Login
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            const result = await pool.query(
                "SELECT * FROM users WHERE email = $1",
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ error: "Usuário não encontrado" });
            }

            const user = result.rows[0];

            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {
                return res.status(400).json({ error: "Senha incorreta" });
            }

            const token = jwt.sign(
                { id: user.id, name: user.name, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "2h" }
            );

            res.json({ message: "Login realizado!", token });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Erro ao fazer login" });
        }
    }
};
