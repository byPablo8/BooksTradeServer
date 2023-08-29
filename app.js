const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const accessTokenSecret = 'mySuperSecretKey123!';
// Configurar conexión a la base de datos MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'BooksTrade'
});

// Función para probar la conexión a la base de datos
function testDatabaseConnection() {
    db.connect((err) => {
        if (err) {
            console.error('Unable to connect to the database:', err);
            return;
        }
        console.log('Connection to the database has been established successfully.');
    });
}

// Probar la conexión a la base de datos
testDatabaseConnection();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta para visualizar todos los libros
app.get('/api/libros', (req, res) => {
    // Selecciona todos los registros de la tabla de libros en la base de datos MySQL
    const sql = 'SELECT * FROM Libros';
    db.query(sql, (error, results, fields) => {
        if (error) throw error;
        res.send(results);
    });
});

// Ruta para obtener los detalles del usuario a partir de un token
app.get('/api/usuario', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, accessTokenSecret, (err, user) => {
        if (err) return res.sendStatus(403);
        const sql = 'SELECT * FROM Usuarios WHERE usuario_id = ?';
        db.query(sql, user.id, (error, results) => {
            if (error) throw error;
            if (results.length > 0) {
                res.send(results[0]);
            } else {
                res.status(404).send({ message: 'Usuario no encontrado' });
            }
        });
    });
});

//Registro de usuarios
app.post('/usuarios', (req, res) => {
    const { nombre, apellido, correo_electronico, usuario, contrasena } = req.body;

    const query = `INSERT INTO Usuarios (nombre, apellido, correo_electronico, usuario, contrasena) VALUES (?, ?, ?, ?, ?)`;

    db.query(query, [nombre, apellido, correo_electronico, usuario, contrasena], (error, results, fields) => {
        if (error) {
            return res.status(500).json({ error });
        }
        res.status(201).json({ message: 'Usuario creado exitosamente' });
    });
});

// Ruta para iniciar sesión
app.post('/login', (req, res) => {
    const { usuario, contrasena } = req.body;

    const sql = 'SELECT * FROM Usuarios WHERE usuario = ?';
    db.query(sql, usuario, (error, results) => {
        if (error) throw error;
        if (results.length > 0) {
            const user = results[0];
            if (contrasena === user.contrasena) {
                const accessToken = jwt.sign({ id: user.usuario_id }, accessTokenSecret);
                res.json({ success: true, accessToken: accessToken });
            } else {
                res.json({ success: false, message: 'Usuario o contraseña incorrecta' });
            }
        } else {
            res.status(400).json({ success: false, message: 'Usuario no encontrado' });
        }
    });
});



//Ver libros de usuario
app.get('/api/usuario/:id/libros', (req, res) => {
    const userId = req.params.id;
    // Usa la conexión a la base de datos para buscar los libros del usuario
    db.query('SELECT * FROM Libros WHERE usuario_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error al recuperar los libros: ', error);
            res.status(500).send('Error al recuperar los libros');
        } else {
            res.json(results);
        }
    });
});

// Ruta para insertar un libro para un usuario específico
app.post('/api/usuario/:id/libros', (req, res) => {
    const userId = req.params.id;
    const { titulo, autor, editorial, fecha_publicacion } = req.body;

    const sql = 'INSERT INTO Libros (titulo, autor, editorial, fecha_publicacion, usuario_id) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [titulo, autor, editorial, fecha_publicacion, userId], (error, results) => {
        if (error) {
            console.error('Error al insertar el libro:', error);
            res.status(500).send('Error al insertar el libro');
        } else {
            res.status(201).send({ message: 'Libro insertado con éxito' });
        }
    });
});

// Ruta para eliminar un libro de un usuario específico
app.delete('/api/usuario/:userId/libros/:libroId', (req, res) => {
    const { userId, libroId } = req.params;

    const sql = 'DELETE FROM Libros WHERE libro_id = ? AND usuario_id = ?';
    db.query(sql, [libroId, userId], (error, results) => {
        if (error) {
            console.error('Error al eliminar el libro:', error);
            res.status(500).send('Error al eliminar el libro');
        } else {
            if (results.affectedRows > 0) {
                res.status(200).send({ message: 'Libro eliminado con éxito' });
            } else {
                res.status(404).send({ message: 'Libro no encontrado' });
            }
        }
    });
});

app.get('/api/usuarios', (req, res) => {
    // Aquí necesitas obtener el token del header de la petición
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401); // Si no hay token, envía un error 401 (Unauthorized)
    }

    jwt.verify(token, accessTokenSecret, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Si el token es inválido, envía un error 403 (Forbidden)
        }

        const sql = 'SELECT usuario_id, nombre, apellido, correo_electronico, usuario FROM Usuarios WHERE usuario_id != ?';
        db.query(sql, user.id, (error, results) => {
            if (error) {
                console.error('Error fetching users:', error);
                res.status(500).json({ error: 'Error fetching users' });
            } else {
                res.json(results);
            }
        });
    });
});

// Ruta de actualización del perfil del usuario
app.put('/api/usuario/:id', (req, res) => {
    const { nombre, apellido, correo_electronico, usuario, contrasena } = req.body;

    const updates = {
        nombre,
        apellido,
        correo_electronico,
        usuario,
    };

    // Solo agrega la contraseña a los updates si se proporcionó una nueva
    if (contrasena) {
        // Considera agregar aquí la lógica para hashear la contraseña antes de guardarla
        updates.contrasena = contrasena;
    }

    const sql = 'UPDATE Usuarios SET ? WHERE usuario_id = ?';
    db.query(sql, [updates, req.params.id], (error, results) => {
        if (error) throw error;
        res.send('Usuario actualizado con éxito.');
    });
});

//borrado
app.delete('/api/usuarioDel/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;

    const deleteQueries = [
        'DELETE FROM Mensajes WHERE sender_id = ? OR receiver_id = ?',
        'DELETE FROM Valoraciones_Resenas WHERE usuario_id = ?',
        'DELETE FROM Libros WHERE usuario_id = ?',
        'DELETE FROM Usuarios WHERE usuario_id = ?',
    ];

    db.beginTransaction(error => {
        if (error) {
            console.error('Error al iniciar la transacción:', error);
            res.status(500).json({ error: 'Hubo un error al iniciar la transacción.' });
            return;
        }

        deleteQueries.forEach((query, index) => {
            db.query(query, [usuario_id, usuario_id], (error, results) => {
                if (error) {
                    return db.rollback(() => {
                        console.error('Error al eliminar:', error);
                        res.status(500).json({ error: 'Hubo un error al eliminar.' });
                    });
                }

                // Si es la última consulta y no hay errores, hacemos commit
                if (index === deleteQueries.length - 1) {
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error al hacer commit:', error);
                                res.status(500).json({ error: 'Hubo un error al finalizar la transacción.' });
                            });
                        }

                        res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
                    });
                }
            });
        });
    });
});




// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
