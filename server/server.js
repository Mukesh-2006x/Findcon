const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: parseInt(process.env.SMTP_PORT || "587") === 465,
      connectionTimeout: 8000, // 8 seconds timeout
      greetingTimeout: 8000,   // 8 seconds timeout
      socketTimeout: 10000,    // 10 seconds socket timeout
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Database initialization
const databaseUrl = process.env.DATABASE_URL || "sqlite:./database.sqlite";
let isMySQL = databaseUrl.startsWith("mysql:");

let sequelize;

// Models and routes are initialized dynamically after connection is established
let Credentials;
let Persona;
let Post;
let Message;

// Helper for generic REST CRUD controller routes
function createCrudRoutes(routerPath, Model) {
  // GET all
  app.get(routerPath, async (req, res) => {
    try {
      const records = await Model.findAll();
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET one by ID
  app.get(`${routerPath}/:id`, async (req, res) => {
    try {
      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ error: "Record not found" });
      res.json(record);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create
  app.post(routerPath, async (req, res) => {
    try {
      const record = await Model.create(req.body);
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT update
  app.put(`${routerPath}/:id`, async (req, res) => {
    try {
      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ error: "Record not found" });
      await record.update(req.body);
      res.json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE remove
  app.delete(`${routerPath}/:id`, async (req, res) => {
    try {
      const record = await Model.findByPk(req.params.id);
      if (!record) return res.status(404).json({ error: "Record not found" });
      await record.destroy();
      res.json({ success: true, message: "Record deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

function setupModelsAndRoutes() {
  // Database Models matching Retool API schemas
  Credentials = sequelize.define("Credentials", {
    userid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    followers: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    following: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    profilepic: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  }, {
    tableName: "credentials",
    timestamps: false,
  });

  Persona = sequelize.define("Persona", {
    userid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    age: {
      type: DataTypes.INTEGER,
      defaultValue: 18,
    },
    gender: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    relationshipstatus: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    city: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    interests: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    othermedia: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    profession: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    bio: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  }, {
    tableName: "persona",
    timestamps: false,
  });

  Post = sequelize.define("Post", {
    userid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    post: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    likes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    title: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    comment: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  }, {
    tableName: "post",
    timestamps: false,
  });

  Message = sequelize.define("Message", {
    userid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    receiverid: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    message: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    timestamp: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: "message",
    timestamps: false,
  });

  // Bind CRUD APIs 1-to-1 matching the Retool endpoints
  createCrudRoutes("/api/credentials", Credentials);
  createCrudRoutes("/api/persona", Persona);
  createCrudRoutes("/api/post", Post);
  createCrudRoutes("/api/message", Message);
}

// Endpoint for sending verification code emails via Nodemailer SMTP (Brevo)
app.post("/api/send-verification", async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ error: "Email and code are required fields" });
  }

  if (!transporter) {
    console.log(`[Verification Simulation] SMTP transporter missing. Code for ${email}: ${code}`);
    return res.json({ success: true, simulated: true, code });
  }

  try {
    const mailOptions = {
      from: `"Findcon" <${process.env.SMTP_USER || "noreply@findcon.com"}>`,
      to: email,
      subject: "Findcon Verification Code",
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; background-color: #0f0f13; color: #ffffff; padding: 40px 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); max-width: 480px; margin: 0 auto;">
          <h2 style="font-family: 'Syne', Arial, sans-serif; font-weight: 800; font-size: 24px; margin-top: 0; margin-bottom: 20px; color: #fff; text-align: center;">
            <span style="color: #ff4081;">Find</span><span style="color: #8e8e93;">con</span>
          </h2>
          <p style="color: rgba(255,255,255,0.75); font-size: 14px; line-height: 1.6; margin-bottom: 25px; text-align: center;">
            Welcome to Findcon! Please use the following 6-digit verification code to complete your action:
          </p>
          <div style="background: rgba(255,64,129,0.08); border: 1px solid rgba(255,64,129,0.22); border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 25px;">
            <span style="font-size: 30px; font-weight: bold; color: #ff80ab; letter-spacing: 5px; font-family: monospace;">${code}</span>
          </div>
          <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-align: center; line-height: 1.4; margin-bottom: 0;">
            This email was sent dynamically using the Brevo SMTP API. If you did not make this request, you can safely ignore this email.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP Email] Verification email sent to ${email}. MessageID: ${info.messageId}`);
    res.json({ success: true, simulated: false });
  } catch (err) {
    console.error("Nodemailer SMTP email error:", err.message);
    res.status(500).json({ error: "Failed to send email via SMTP", message: err.message });
  }
});

// Database Sync and Server Listen
async function ensureDatabaseExists() {
  if (databaseUrl.startsWith("mysql:")) {
    try {
      const mysql = require("mysql2/promise");
      const url = new URL(databaseUrl);
      const dbName = url.pathname.replace(/^\//, "");
      
      const connection = await mysql.createConnection({
        host: url.hostname,
        port: url.port || 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password || ""),
        connectTimeout: 5000, // Timeout after 5s
        ssl: {
          minVersion: "TLSv1.2",
          rejectUnauthorized: process.env.REJECT_UNAUTHORIZED === "true",
          ca: process.env.CA_PATH && fs.existsSync(process.env.CA_PATH)
            ? fs.readFileSync(process.env.CA_PATH)
            : undefined,
        },
      });
      
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      await connection.end();
      console.log(`Database "${dbName}" checked/created successfully.`);
    } catch (err) {
      console.warn("Database pre-creation check skipped or failed:", err.message);
      throw err; // Propagate error to trigger fallback
    }
  }
}

async function startServer() {
  let connected = false;

  if (isMySQL) {
    try {
      console.log("Attempting to connect to cloud MySQL/TiDB database...");
      await ensureDatabaseExists();

      // Instantiate Sequelize with MySQL
      sequelize = new Sequelize(databaseUrl, {
        logging: false,
        dialectOptions: {
          connectTimeout: 5000, // 5s connection timeout for Sequelize
          ssl: {
            minVersion: "TLSv1.2",
            rejectUnauthorized: process.env.REJECT_UNAUTHORIZED === "true",
            ca: process.env.CA_PATH && fs.existsSync(process.env.CA_PATH)
              ? fs.readFileSync(process.env.CA_PATH)
              : undefined,
          },
        },
      });

      await sequelize.authenticate();
      connected = true;
      console.log("Connected to MySQL database successfully.");
    } catch (err) {
      console.error("\n======================================================================");
      console.error("WARNING: Failed to connect to MySQL/TiDB Cloud database.");
      console.error("Error details:", err.message);
      console.error("Please add '0.0.0.0/0' to your TiDB Cloud IP Access List to connect locally.");
      console.error("======================================================================\n");
      console.log("Falling back to local SQLite database (database.sqlite)...");
    }
  }

  if (!connected) {
    sequelize = new Sequelize("sqlite:./database.sqlite", {
      logging: false,
    });
    try {
      await sequelize.authenticate();
      console.log("Connected to fallback SQLite database successfully.");
    } catch (err) {
      console.error("Failed to initialize SQLite database:", err.message);
      process.exit(1);
    }
  }

  // Define models and routes on the chosen sequelize instance
  setupModelsAndRoutes();

  try {
    // Sync tables
    await sequelize.sync();
    console.log("Database models synchronized with database.");

    app.listen(PORT, () => {
      console.log(`Findcon backend server is listening on port ${PORT}`);
      console.log(`Local endpoints mapped: http://localhost:${PORT}/api/`);
    });
  } catch (err) {
    console.error("Unable to start server during synchronization:", err);
  }
}

startServer();