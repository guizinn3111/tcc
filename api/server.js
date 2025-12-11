require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const pool = require("./db");

app.use(cors());
app.use(express.json());

// ==============================
// ROTA INICIAL
// ==============================
app.get("/", (req, res) => {
    res.send("API do DevClub Café conectada ao PostgreSQL! ☕");
});

// ==============================
// PRODUTOS
// ==============================
app.get("/product", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
            COALESCE(s.amount, 0) AS stock 
            FROM products p
            LEFT JOIN stock s ON s.product_id = p.id
            ORDER BY p.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar produtos" });
    }
});

app.get("/product/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT p.*, COALESCE(s.amount, 0) AS stock 
             FROM products p
             LEFT JOIN stock s ON s.product_id = p.id
             WHERE p.id = $1`,
            [id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: "Produto não encontrado" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar produto" });
    }
});

// Criar produto (ACEITA APENAS JSON)
app.post("/product", async (req, res) => {
    try {
        const { nome, preco, image_url } = req.body;

        const result = await pool.query(
            "INSERT INTO products (name, price, image_url) VALUES ($1, $2, $3) RETURNING *",
            [nome, preco, image_url]
        );

        // cria o estoque automaticamente com 0
        await pool.query("INSERT INTO stock (product_id, amount) VALUES ($1, 0)", [
            result.rows[0].id
        ]);

        res.json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Erro ao criar produto" });
    }
});

// Editar produto (ACEITA APENAS JSON)
app.put("/product/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, preco, image_url } = req.body;

        const result = await pool.query(
            "UPDATE products SET name = $1, price = $2, image_url = $3 WHERE id = $4 RETURNING *",
            [nome, preco, image_url, id]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: "Produto não encontrado" });

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar produto" });
    }
});

// Deletar produto
app.delete("/product/:id", async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query("DELETE FROM stock WHERE product_id = $1", [id]);
        await pool.query("DELETE FROM products WHERE id = $1", [id]);

        res.json({ message: "Produto removido com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: "Erro ao remover produto" });
    }
});

// ==============================
// USERS
// ==============================
app.post("/users", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const result = await pool.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
            [name, email, password]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/users", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email FROM users");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// STOCK
// ==============================
app.put("/stock/:product_id", async (req, res) => {
    try {
        const { product_id } = req.params;
        const { amount } = req.body;

        const result = await pool.query(
            "UPDATE stock SET amount = $1 WHERE product_id = $2 RETURNING *",
            [amount, product_id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// CART & CART PRODUCTS
// ==============================
app.post("/cart-products", async (req, res) => {
    try {
        const { cart_id, product_id, quantity } = req.body;

        const stock = await pool.query(
            "SELECT amount FROM stock WHERE product_id = $1",
            [product_id]
        );

        if (stock.rows.length === 0)
            return res.status(400).json({ error: "Produto sem estoque cadastrado" });

        if (stock.rows[0].amount <= 0)
            return res.status(400).json({ error: "Produto fora de estoque" });

        if (quantity > stock.rows[0].amount)
            return res.status(400).json({ error: "Quantidade solicitada maior que o estoque" });

        const result = await pool.query(
            "INSERT INTO cart_products (cart_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *",
            [cart_id, product_id, quantity]
        );

        await pool.query(
            "UPDATE stock SET amount = amount - $1 WHERE product_id = $2",
            [quantity, product_id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/cart-products/:cart_id", async (req, res) => {
    try {
        const { cart_id } = req.params;
        const result = await pool.query(
            `SELECT cp.id, p.name, p.price, cp.quantity
             FROM cart_products cp
             JOIN products p ON p.id = cp.product_id
             WHERE cp.cart_id = $1`,
            [cart_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/cart/item/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const item = await pool.query("SELECT * FROM cart_products WHERE id = $1", [id]);

        if (item.rows.length > 0) {
            await pool.query(
                "UPDATE stock SET amount = amount + $1 WHERE product_id = $2",
                [item.rows[0].quantity, item.rows[0].product_id]
            );
        }

        await pool.query("DELETE FROM cart_products WHERE id = $1", [id]);

        res.json({ message: "Item removido do carrinho!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==============================
// LOGIN
// ==============================
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query(
            "SELECT id, name, email FROM users WHERE email = $1 AND password = $2",
            [email, password]
        );
        if (result.rows.length === 0)
            return res.status(401).json({ error: "Credenciais inválidas" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro no login" });
    }
});

// ==============================
// ORDERS - salvar nota fiscal
// ==============================
app.post("/orders", async (req, res) => {
    try {
        const { customer, cpf, payment, items } = req.body;

        if (!customer || !cpf || !payment || !items || items.length === 0)
            return res.status(400).json({ error: "Dados incompletos" });

        const total = items.reduce((sum, i) => sum + i.subtotal, 0);

        // Inserir pedido
        const orderResult = await pool.query(
            "INSERT INTO orders (customer_name, cpf, payment_method, total) VALUES ($1, $2, $3, $4) RETURNING *",
            [customer, cpf, payment, total]
        );

        const orderId = orderResult.rows[0].id;

        // Inserir itens do pedido
        for (const i of items) {
            await pool.query(
                "INSERT INTO order_items (order_id, product_id, quantity, subtotal) VALUES ($1, $2, $3, $4)",
                [orderId, i.product_id, i.qty, i.subtotal]
            );
        }

        res.json({ message: "Pedido salvo com sucesso!", orderId });
    } catch (err) {
        console.error("Erro ao salvar pedido:", err);
        res.status(500).json({ error: "Erro ao salvar pedido" });
    }
});

// ==============================
// SERVIDOR
// ==============================
app.listen(process.env.PORT, () => {
    console.log(`Servidor rodando em http://localhost:${process.env.PORT}`);
});
