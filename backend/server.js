const express = require('express');
const { Pool } = require('pg');  
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// CONFIGURACIÓN DE POSTGRESQL
// =====================================================
const db = new Pool({
    host: 'localhost',
    user: 'postgres',        
    password: '1234', 
    database: 'maquinas_industriales',
    port: 5432,             
    max: 10,                 
    idleTimeoutMillis: 30000,
});

// Probar conexión
    db.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar a PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conectado a PostgreSQL');
        release();
    }
});

// Endpoint para crear una nueva venta
app.post('/api/ventas', async (req, res) => {

   /* console.log('Body recibido:', req.body);  // ← Si sale undefined, el middleware no funciona
    console.log('Items:', req.body.items); */  

    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { items, total, fecha } = req.body;
        
        // Validar que hay items en el carrito
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'El carrito está vacío' });
        }
        
        // Insertar la venta principal
        const ventaQuery = `
            INSERT INTO ventas (fecha, total, estado) 
            VALUES ($1, $2, $3) 
            RETURNING id
        `;
        const ventaValues = [fecha || new Date(), total, 'completada'];
        const ventaResult = await client.query(ventaQuery, ventaValues);
        
        const ventaId = ventaResult.rows[0].id;
        
        // Insertar cada detalle de la venta
        const detalleQuery = `
            INSERT INTO venta_detalles 
            (venta_id, producto_id, cantidad, precio_unitario, subtotal) 
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        /* console.log('Items recibidos:', req.body.items);
        console.log('Tipo de items:', typeof req.body.items);
        console.log('¿Es arreglo?', Array.isArray(req.body.items)); */

        for (const item of items) {
            await client.query(detalleQuery, [
                ventaId, 
                item.id, 
                item.cantidad, 
                item.precio, 
                item.subtotal
            ]);
        }
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Venta registrada exitosamente',
            ventaId: ventaId,
            venta: {
                id: ventaId,
                fecha: fecha || new Date(),
                total: total,
                items_count: items.length
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear venta:', error);
        res.status(500).json({ 
            error: 'Error al procesar la venta',
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// Endpoint para obtener el historial de ventas
app.get('/api/ventas', async (req, res) => {
    try {
        const query = `
            SELECT v.*, 
                   COUNT(vd.id) as items_count,
                   STRING_AGG(p.nombre, ', ') as productos
            FROM ventas v
            LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
            LEFT JOIN producto p ON vd.producto_id = p.id
            GROUP BY v.id
            ORDER BY v.fecha DESC
        `;
        
        const result = await db.query(query);
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({ error: 'Error al obtener el historial de ventas' });
    }
});

// Endpoint para obtener detalles de una venta específica
app.get('/api/ventas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtener la venta
        const ventaQuery = 'SELECT * FROM ventas WHERE id = $1';
        const ventaResult = await db.query(ventaQuery, [id]);
        
        if (ventaResult.rows.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        // Obtener los detalles
        const detallesQuery = `
            SELECT vd.*, p.nombre, p.descripcion, p.icon
            FROM venta_detalles vd
            JOIN producto p ON vd.producto_id = p.id
            WHERE vd.venta_id = $1
        `;
        const detallesResult = await db.query(detallesQuery, [id]);
        
        res.json({
            venta: ventaResult.rows[0],
            detalles: detallesResult.rows
        });
        
    } catch (error) {
        console.error('Error al obtener detalles de venta:', error);
        res.status(500).json({ error: 'Error al obtener los detalles de la venta' });
    }
});

// Endpoint para obtener estadísticas de ventas
app.get('/api/ventas/estadisticas/resumen', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as ingresos_totales,
                COALESCE(AVG(total), 0) as promedio_venta,
                COUNT(DISTINCT DATE(fecha)) as dias_con_ventas,
                MIN(fecha) as primera_venta,
                MAX(fecha) as ultima_venta
            FROM ventas
            WHERE estado = 'completada'
        `;
        
        const result = await db.query(query);
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener las estadísticas' });
    }
});

// Endpoint para cancelar una venta
app.put('/api/ventas/:id/cancelar', async (req, res) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        
        // Verificar que la venta existe
        const checkQuery = 'SELECT id, estado FROM ventas WHERE id = $1';
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        
        if (checkResult.rows[0].estado === 'cancelada') {
            return res.status(400).json({ error: 'La venta ya está cancelada' });
        }
        
        // Cancelar la venta
        const updateQuery = `
            UPDATE ventas 
            SET estado = 'cancelada' 
            WHERE id = $1 
            RETURNING *
        `;
        const updateResult = await client.query(updateQuery, [id]);
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Venta cancelada exitosamente',
            venta: updateResult.rows[0]
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al cancelar venta:', error);
        res.status(500).json({ error: 'Error al cancelar la venta' });
    } finally {
        client.release();
    }
});

// =====================================================
// ENDPOINTS DE AUTENTICACIÓN
// =====================================================

// Login para administradores y clientes
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Buscar en tabla de administradores
        const admins = await db.query(
            'SELECT * FROM Administrador WHERE email = $1',
            [email]
        );
        
        if (admins.rows.length > 0) {
            const admin = admins.rows[0];
            
            if (password === admin.password) {
                res.json({
                    success: true,
                    usuario: {
                        id: admin.id,
                        nombre: admin.nombre,
                        email: admin.email,
                        rol: admin.rol,
                        tipo: 'admin'
                    }
                });
                return;
            }
        }
        
        // Buscar en tabla de clientes
        const clientes = await db.query(
            'SELECT * FROM Cliente WHERE email = $1 AND activo = TRUE',
            [email]
        );
        
        if (clientes.rows.length > 0) {
            const cliente = clientes.rows[0];
            
            if (password === cliente.password) {
                res.json({
                    success: true,
                    usuario: {
                        id: cliente.id,
                        nombre: cliente.nombre,
                        email: cliente.email,
                        telefono: cliente.telefono,
                        direccion: cliente.direccion,
                        tipo: 'cliente'
                    }
                });
                return;
            }
        }
        
        res.status(401).json({
            success: false,
            message: 'Credenciales incorrectas'
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor'
        });
    }
});

// =====================================================
// ENDPOINTS PARA CLIENTES
// =====================================================

// Obtener cliente por ID
app.get('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.query(
            'SELECT id, nombre, email, telefono, direccion, fecha_registro FROM Cliente WHERE id = $1',
            [id]
        );
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Cliente no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Actualizar cliente
app.put('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, direccion } = req.body;
    
    try {
        await db.query(
            'UPDATE Cliente SET nombre = $1, email = $2, telefono = $3, direccion = $4 WHERE id = $5',
            [nombre, email, telefono, direccion, id]
        );
        
        res.json({ 
            success: true, 
            message: 'Cliente actualizado correctamente',
            cliente: { id, nombre, email, telefono, direccion }
        });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// =====================================================
// ENDPOINTS PARA COMPRAS
// =====================================================

// Obtener compras de un cliente específico
app.get('/api/compras/cliente/:clienteId', async (req, res) => {
    const { clienteId } = req.params;
    
    try {
        const query = `
            SELECT 
                c.id,
                c.fecha,
                c.total,
                c.estado,
                c.metodo_pago,
                c.direccion_envio,
                string_agg(p.nombre, ', ') as productos
            FROM Compra c
            LEFT JOIN Compra_Producto cp ON c.id = cp.compra_id
            LEFT JOIN Producto p ON cp.producto_id = p.id
            WHERE c.cliente_id = $1
            GROUP BY c.id, c.fecha, c.total, c.estado, c.metodo_pago, c.direccion_envio
            ORDER BY c.fecha DESC
        `;
        
        const result = await db.query(query, [clienteId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener compras:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Obtener detalles de una compra específica
app.get('/api/compras/detalle/:compraId', async (req, res) => {
    const { compraId } = req.params;
    
    try {
        const result = await db.query(
            `SELECT 
                cp.*,
                p.nombre as producto_nombre,
                p.descripcion
             FROM Compra_Producto cp
             JOIN Producto p ON cp.producto_id = p.id
             WHERE cp.compra_id = $1`,
            [compraId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener detalles:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// =====================================================
// ENDPOINTS PARA PRODUCTOS
// =====================================================

// Obtener todos los productos
app.get('/api/producto', (req, res) => {
    const query = 'SELECT * FROM producto ORDER BY id DESC';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener productos:', err);
            return res.status(500).json({ error: 'Error al obtener productos' });
        }
        res.json(results);
    });
});

// Obtener un producto por ID
app.get('/api/producto/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM producto WHERE id = ?';
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener producto:', err);
            return res.status(500).json({ error: 'Error al obtener producto' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(results[0]);
    });
});

    // Crear un nuevo producto (versión mejorada para PostgreSQL)
app.post('/api/producto', async (req, res) => {
    try {
        console.log('📦 Recibiendo solicitud para crear producto:');
        console.log('Body:', req.body);
        
        const { nombre, descripcion, precio, stock, categoria, imagen_url, activo } = req.body;
        
        // Validaciones detalladas
        const errores = [];
        if (!nombre || nombre.trim() === '') errores.push('El nombre es requerido');
        if (!precio || isNaN(parseFloat(precio))) errores.push('El precio debe ser un número válido');
        if (stock === undefined || isNaN(parseInt(stock))) errores.push('El stock debe ser un número válido');
        if (!categoria || categoria === '') errores.push('La categoría es requerida');
        
        if (errores.length > 0) {
            console.log('❌ Errores de validación:', errores);
            return res.status(400).json({ error: errores.join(', ') });
        }
        
        // Convertir y validar valores numéricos
        const precioNum = parseFloat(precio);
        const stockNum = parseInt(stock);
        const activoBool = activo === true || activo === 1 || activo === 'true';
        
        if (precioNum <= 0) {
            return res.status(400).json({ error: 'El precio debe ser mayor a 0' });
        }
        if (stockNum < 0) {
            return res.status(400).json({ error: 'El stock no puede ser negativo' });
        }
        
        // Preparar valores para la consulta
        const nombreTrim = nombre.trim();
        const descripcionTrim = descripcion ? descripcion.trim() : null;
        const imagenUrlTrim = imagen_url && imagen_url.trim() !== '' ? imagen_url.trim() : null;
        
        const query = `
            INSERT INTO producto (nombre, descripcion, precio, stock, categoria, imagen_url, activo) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, nombre, precio, stock
        `;
        
        const values = [nombreTrim, descripcionTrim, precioNum, stockNum, categoria, imagenUrlTrim, activoBool];
        
        console.log('📝 Ejecutando consulta:', query);
        console.log('📝 Valores:', values);
        
        const result = await db.query(query, values);
        
        console.log('✅ Producto creado exitosamente:', result.rows[0]);
        
        res.status(201).json({ 
            success: true,
            message: 'Producto creado exitosamente', 
            producto: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Error detallado al crear producto:', error);
        
        // Manejar errores específicos de PostgreSQL
        if (error.code === '23505') { // Código de violación de unique constraint
            return res.status(400).json({ error: 'Ya existe un producto con ese nombre' });
        }
        if (error.code === '23502') { // Not null violation
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        
        res.status(500).json({ 
            error: 'Error al crear producto en la base de datos', 
            details: error.message 
        });
    }
});

// Actualizar un producto
app.put('/api/producto/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, imagen_url, activo } = req.body;
    
    const query = `
        UPDATE producto
        SET nombre = ?, descripcion = ?, precio = ?, stock = ?, categoria = ?, imagen_url = ?, activo = ?
        WHERE id = ?
    `;
    
    db.query(query, [nombre, descripcion, precio, stock, categoria, imagen_url, activo, id], (err, result) => {
        if (err) {
            console.error('Error al actualizar producto:', err);
            return res.status(500).json({ error: 'Error al actualizar producto' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ message: 'Producto actualizado exitosamente' });
    });
});

// Eliminar un producto (o desactivarlo)
app.delete('/api/producto/:id', (req, res) => {
    const { id } = req.params;
    
    // Opción 1: Eliminar físicamente
    const query = 'DELETE FROM producto WHERE id = ?';
    
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar producto:', err);
            return res.status(500).json({ error: 'Error al eliminar producto' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ message: 'Producto eliminado exitosamente' });
    });
    
    // Opción 2: Desactivar (soft delete) - recomendado
    // const query = 'UPDATE productos SET activo = 0 WHERE id = ?';
});

// Obtener productos activos (disponibles para venta)
app.get('/api/producto/activos', (req, res) => {
    const query = 'SELECT * FROM producto WHERE activo = 1 ORDER BY nombre';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener productos activos:', err);
            return res.status(500).json({ error: 'Error al obtener productos activos' });
        }
        res.json(results);
    });
});

// Actualizar stock de un producto después de una venta
app.patch('/api/producto/:id/stock', (req, res) => {
    const { id } = req.params;
    const { cantidad_vendida } = req.body;
    
    const query = 'UPDATE producto SET stock = stock - ? WHERE id = ? AND stock >= ?';
    
    db.query(query, [cantidad_vendida, id, cantidad_vendida], (err, result) => {
        if (err) {
            console.error('Error al actualizar stock:', err);
            return res.status(500).json({ error: 'Error al actualizar stock' });
        }
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Stock insuficiente o producto no encontrado' });
        }
        res.json({ message: 'Stock actualizado exitosamente' });
    });
});
// Obtener todos los productos activos
app.get('/api/producto', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM producto WHERE activo = TRUE ORDER BY nombre'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Obtener producto por ID
app.get('/api/producto/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.query(
            'SELECT * FROM producto WHERE id = $1',
            [id]
        );
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// =====================================================
// ENDPOINTS PARA MAQUINARIA/EQUIPO (ADMIN)
// =====================================================

// Obtener todas las máquinas y herramientas
app.get('/api/maquinas', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM Producto WHERE categoria IN ($1, $2, $3) ORDER BY categoria, nombre',
            ['Maquinaria', 'Herramientas', 'Equipo']
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener máquinas:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Registrar nueva adquisición (máquina/herramienta)
app.post('/api/maquinas', async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria } = req.body;
    
    try {
        await db.query(
            'INSERT INTO producto (nombre, descripcion, precio, stock, categoria) VALUES ($1, $2, $3, $4, $5)',
            [nombre, descripcion, precio, stock, categoria]
        );
        
        res.json({ success: true, message: 'Equipo registrado correctamente' });
    } catch (error) {
        console.error('Error al registrar equipo:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// =====================================================
// ENDPOINTS PARA VENTAS (ADMIN)
// =====================================================

// Registrar nueva venta
app.post('/api/ventas', async (req, res) => {
    const { cliente_id, productos, total, metodo_pago } = req.body;
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Insertar compra
        const compraResult = await client.query(
            'INSERT INTO Compra (cliente_id, total, metodo_pago, estado) VALUES ($1, $2, $3, $4) RETURNING id',
            [cliente_id, total, metodo_pago, 'pendiente']
        );
        
        const compraId = compraResult.rows[0].id;
        
        // Insertar detalles de compra
        for (const producto of productos) {
            await client.query(
                'INSERT INTO Compra_Producto (compra_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1, $2, $3, $4, $5)',
                [compraId, producto.id, producto.cantidad, producto.precio, producto.subtotal]
            );
            
            // Actualizar stock
            await client.query(
                'UPDATE Producto SET stock = stock - $1 WHERE id = $2',
                [producto.cantidad, producto.id]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Venta registrada', compraId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar venta:', error);
        res.status(500).json({ message: 'Error del servidor' });
    } finally {
        client.release();
    }
});

// =====================================================
// ENDPOINTS PARA REPORTES Y BALANCES
// =====================================================

// Balance mensual
app.get('/api/balance/:anio/:mes', async (req, res) => {
    const { anio, mes } = req.params;
    
    try {
        // Ventas del mes
        const ventasResult = await db.query(
            `SELECT COALESCE(SUM(total), 0) as total_ventas 
             FROM Compra 
             WHERE EXTRACT(YEAR FROM fecha) = $1 
             AND EXTRACT(MONTH FROM fecha) = $2 
             AND estado IN ('completado', 'enviado')`,
            [anio, mes]
        );
        
        // Adquisiciones del mes (simplificado)
        const adquisicionesResult = await db.query(
            `SELECT COALESCE(SUM(precio * cantidad), 0) as total_adquisiciones 
             FROM Compra_Producto cp 
             JOIN Producto p ON cp.producto_id = p.id`,
            []
        );
        
        const totalVentas = parseFloat(ventasResult.rows[0].total_ventas);
        const totalAdquisiciones = parseFloat(adquisicionesResult.rows[0].total_adquisiciones);
        
        res.json({
            ventas: totalVentas,
            adquisiciones: totalAdquisiciones,
            balance: totalVentas - totalAdquisiciones
        });
    } catch (error) {
        console.error('Error al calcular balance:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});
// =====================================================
// ENDPOINT PARA MÁQUINAS (TABLA SEPARADA)
// =====================================================

// Obtener todas las máquinas
app.get('/api/maquinas', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id_maquina as id, nombre, descripcion, precio, icon FROM maquinas ORDER BY nombre'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener máquinas:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Obtener una máquina específica por ID
app.get('/api/maquinas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'SELECT id_maquina as id, nombre, descripcion, precio, icon FROM maquinas WHERE id_maquina = $1',
            [id]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Máquina no encontrada' });
        }
    } catch (error) {
        console.error('Error al obtener máquina:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// Endpoint para máquinas (tabla separada)
app.get('/api/maquinas', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id_maquina as id, nombre, descripcion, precio, COALESCE(icon, \'fa-industry\') as icon FROM maquinas ORDER BY nombre'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener máquinas:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// ==================== ENDPOINTS PARA PRODUCTOS ====================

// Obtener todos los productos
app.get('/api/producto', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM producto ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener productos:', err);
        res.status(500).json({ error: 'Error al obtener productos: ' + err.message });
    }
});

// Obtener un producto por ID
app.get('/api/producto/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM producto WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener producto:', err);
        res.status(500).json({ error: 'Error al obtener producto: ' + err.message });
    }
});

// Crear un nuevo producto
app.post('/api/producto', async (req, res) => {
    const { nombre, descripcion, precio, stock, categoria, imagen_url, activo } = req.body;
    
    // console.log('📦 Datos recibidos:', { nombre, descripcion, precio, stock, categoria, imagen_url, activo });
    
    // Validaciones
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    
    if (!precio || isNaN(precio) || precio <= 0) {
        return res.status(400).json({ error: 'Precio válido requerido' });
    }
    
    if (stock === undefined || isNaN(stock) || stock < 0) {
        return res.status(400).json({ error: 'Stock válido requerido' });
    }
    
    if (!categoria || categoria.trim() === '') {
        return res.status(400).json({ error: 'Categoría requerida' });
    }
    
    const imagenValue = imagen_url && imagen_url.trim() !== '' ? imagen_url : null;
    const activoValue = activo !== undefined ? activo : true;
    const descripcionValue = descripcion && descripcion.trim() !== '' ? descripcion : null;
    
    const query = `
        INSERT INTO producto (nombre, descripcion, precio, stock, categoria, imagen_url, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `;
    
    const values = [
        nombre.trim(),
        descripcionValue,
        precio,
        stock,
        categoria.trim(),
        imagenValue,
        activoValue
    ];
    
   // console.log('📝 Query:', query);
   // console.log('📝 Values:', values);
    
    try {
        const result = await db.query(query, values);
        console.log('✅ Producto creado con ID:', result.rows[0].id);
        
        res.status(201).json({ 
            message: 'Producto creado exitosamente',
            id: result.rows[0].id
        });
    } catch (err) {
        console.error('❌ Error DETALLADO al crear producto:', err);
        console.error('❌ Código de error:', err.code);
        console.error('❌ Mensaje completo:', err.message);
        
        res.status(500).json({ 
            error: 'Error al crear producto',
            details: err.message,
            code: err.code
        });
    }
});

// Actualizar un producto
app.put('/api/producto/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, imagen_url, activo } = req.body;
    
    // Validaciones básicas
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
    }
    
    if (!precio || isNaN(precio) || precio <= 0) {
        return res.status(400).json({ error: 'El precio debe ser un número mayor a 0' });
    }
    
    if (stock === undefined || isNaN(stock) || stock < 0) {
        return res.status(400).json({ error: 'El stock debe ser un número válido (0 o más)' });
    }
    
    if (!categoria || categoria.trim() === '') {
        return res.status(400).json({ error: 'La categoría es obligatoria' });
    }
    
    const imagenValue = imagen_url && imagen_url.trim() !== '' ? imagen_url : null;
    const activoValue = activo !== undefined ? activo : true;
    const descripcionValue = descripcion && descripcion.trim() !== '' ? descripcion : null;
    
    const query = `
        UPDATE producto 
        SET nombre = $1, descripcion = $2, precio = $3, stock = $4, 
            categoria = $5, imagen_url = $6, activo = $7
        WHERE id = $8
    `;
    
    try {
        const result = await db.query(query, [
            nombre.trim(), 
            descripcionValue, 
            precio, 
            stock, 
            categoria.trim(), 
            imagenValue, 
            activoValue, 
            id
        ]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        res.json({ message: 'Producto actualizado exitosamente' });
    } catch (err) {
        console.error('Error al actualizar producto:', err);
        res.status(500).json({ error: 'Error al actualizar producto: ' + err.message });
    }
});

// Eliminar un producto (borrado lógico - desactivar)
app.delete('/api/producto/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.query('UPDATE producto SET activo = false WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        res.json({ message: 'Producto desactivado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar producto:', err);
        res.status(500).json({ error: 'Error al eliminar producto: ' + err.message });
    }
});

// Eliminar producto físicamente (solo para administradores)
app.delete('/api/producto/:id/permanent', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.query('DELETE FROM producto WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        res.json({ message: 'Producto eliminado permanentemente' });
    } catch (err) {
        console.error('Error al eliminar producto permanentemente:', err);
        res.status(500).json({ error: 'Error al eliminar producto: ' + err.message });
    }
});
// =====================================================
// INICIAR EL SERVIDOR
// =====================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Endpoints disponibles:`);
    console.log(`   POST   /api/login`);
    console.log(`   GET    /api/clientes/:id`);
    console.log(`   PUT    /api/clientes/:id`);
    console.log(`   GET    /api/compras/cliente/:clienteId`);
    console.log(`   GET    /api/productos`);
    console.log(`   GET    /api/maquinas`);
    console.log(`   POST   /api/maquinas`);
    console.log(`   POST   /api/ventas`);
    console.log(`   GET    /api/balance/:anio/:mes`);
});