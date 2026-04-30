const URL_DB = 'https://bawhnopbfygbyimuoqjh.supabase.co';
const KEY_DB = 'sb_publishable_wppuPKcVUdVrVFe9A-VYDw_9kL-B8me';
const instanciaSupabase = window.supabase.createClient(URL_DB, KEY_DB);

let inventario = [];
let editandoID = null;
let currentUser = null;

// --- GESTIÓN DE SESIÓN ---
instanciaSupabase.auth.onAuthStateChange(async (event, session) => {
    const authContainer = document.getElementById('auth-container');
    const mainContent = document.getElementById('main-content');
    const userDisplay = document.getElementById('user-display');

    if (session) {
        const { data, error } = await instanciaSupabase
            .from('clientes_autorizados')
            .select('activo')
            .eq('email', session.user.email)
            .single();

        if (error || !data || data.activo === false) {
            alert("⚠️ LICENCIA NO ACTIVA. Contactá soporte.");
            await instanciaSupabase.auth.signOut();
            return;
        }

        currentUser = session.user;
        if(authContainer) authContainer.style.display = 'none';
        if(mainContent) mainContent.style.display = 'block';
        if(userDisplay) userDisplay.innerText = `CERRAR SESIÓN (${currentUser.email})`;
        cargarDatosSupabase();
    } else {
        currentUser = null;
        if(authContainer) authContainer.style.display = 'flex';
        if(mainContent) mainContent.style.display = 'none';
    }
});

// --- FUNCIONES DE AUTENTICACIÓN MEJORADAS ---
async function login() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const errorDisplay = document.getElementById('auth-error');

    if (!email || !password) {
        if(errorDisplay) errorDisplay.innerText = "Por favor, completa todos los campos.";
        return;
    }

    const { data, error } = await instanciaSupabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        console.error("Error completo:", error);
        if(errorDisplay) errorDisplay.innerText = "Error al ingresar: " + error.message;
    } else {
        if(errorDisplay) errorDisplay.innerText = "";
    }
}

async function register() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const errorDisplay = document.getElementById('auth-error');

    if (password.length < 6) {
        if(errorDisplay) errorDisplay.innerText = "La contraseña debe tener al menos 6 caracteres.";
        return;
    }

    const { data, error } = await instanciaSupabase.auth.signUp({ email, password });
    
    if (error) {
        console.error("Error completo:", error);
        if(errorDisplay) errorDisplay.innerText = "Error al registrarse: " + error.message;
    } else {
        alert("¡Registro exitoso! Revisa tu email si la confirmación está activa.");
        if(errorDisplay) errorDisplay.innerText = "";
    }
}

// --- LÓGICA DE PRODUCTOS ---
async function cargarDatosSupabase() {
    const { data, error } = await instanciaSupabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

    if (!error) {
        inventario = data;
        renderizarTabla();
        actualizarContadores();
    }
}

async function procesarProducto() {
    const nombre = document.getElementById('prod-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('prod-cantidad').value);
    const precio = parseFloat(document.getElementById('prod-precio').value);

    if (!nombre || isNaN(cantidad) || isNaN(precio)) return alert("Faltan datos.");

    if (editandoID) {
        await instanciaSupabase.from('productos').update({ 
            nombre: nombre.toUpperCase(), cantidad, precio 
        }).eq('id', editandoID);
        cancelarEdicion();
    } else {
        // Quitamos el user_id del insert si da problemas de RLS, o asegúrate de que sea válido
        await instanciaSupabase.from('productos').insert([{ 
            nombre: nombre.toUpperCase(), cantidad, precio, user_id: currentUser.id 
        }]);
    }
    limpiarCampos();
    await cargarDatosSupabase();
}

function renderizarTabla() {
    const tbody = document.getElementById('lista-stock');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    inventario.forEach(p => {
        const fila = document.createElement('tr');
        if (p.cantidad <= 5) fila.className = 'low-stock';
        
        fila.innerHTML = `
            <td>${p.nombre}</td>
            <td><strong>${p.cantidad} u.</strong></td>
            <td>$${p.precio.toLocaleString()}</td>
            <td>
                <input type="number" id="venta-${p.id}" placeholder="0" style="width:50px">
                <button class="btn-sell" onclick="registrarVenta(${p.id})">OK</button>
            </td>
            <td style="color:#22c55e; font-weight:bold;">$${(p.cantidad * p.precio).toLocaleString()}</td>
            <td>
                <button class="btn-action edit" onclick="prepararEdicion(${p.id})"><i class="fas fa-pen"></i></button>
                <button class="btn-action delete" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// --- TERMINAL DE VENTAS (REPARADA) ---
function ejecutarComando(event) {
    const input = document.getElementById('console-input');
    const valor = input.value.trim().toUpperCase();
    if (!valor) return;

    const partes = valor.split(" ");
    const cant = parseInt(partes[0]);
    const nombre = partes.slice(1).join(" ");

    if (isNaN(cant) || !nombre) {
        agregarLogTerminal("Error: Usa '3 COCA'", "#ef4444");
    } else {
        const prod = inventario.find(p => p.nombre === nombre);
        if (prod) {
            if (prod.cantidad >= cant) {
                hacerVentaRapida(prod.id, prod.cantidad - cant);
                agregarLogTerminal(`Vendido ${cant} ${nombre}`, "#22c55e");
            } else {
                agregarLogTerminal("Stock insuficiente", "#ef4444");
            }
        } else {
            agregarLogTerminal("No encontrado", "#fbbf24");
        }
    }
    input.value = "";
}

async function hacerVentaRapida(id, nuevaCant) {
    await instanciaSupabase.from('productos').update({ cantidad: nuevaCant }).eq('id', id);
    await cargarDatosSupabase();
}

function agregarLogTerminal(msg, color) {
    const log = document.getElementById('console-log');
    const entry = document.createElement('div');
    entry.style.color = color;
    entry.innerText = `> ${msg}`;
    log.prepend(entry);
}

function toggleConsole() {
    const body = document.getElementById('console-body');
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

function filtrarProductos() {
    const buscado = document.getElementById('search-input').value.toUpperCase();
    const filas = document.querySelectorAll('#lista-stock tr');
    filas.forEach(fila => {
        const nombre = fila.cells[0].innerText;
        fila.style.display = nombre.includes(buscado) ? '' : 'none';
    });
}

// --- UTILIDADES ---
async function registrarVenta(id) {
    const input = document.getElementById(`venta-${id}`);
    const cant = parseInt(input.value);
    const p = inventario.find(prod => prod.id === id);
    if (isNaN(cant) || cant <= 0 || cant > p.cantidad) return alert("Cant. inválida");
    await instanciaSupabase.from('productos').update({ cantidad: p.cantidad - cant }).eq('id', id);
    await cargarDatosSupabase();
}

async function eliminarProducto(id) {
    if (confirm("¿Borrar?")) {
        await instanciaSupabase.from('productos').delete().eq('id', id);
        await cargarDatosSupabase();
    }
}

function actualizarContadores() {
    document.getElementById('count-total').innerText = inventario.length;
    document.getElementById('count-low').innerText = inventario.filter(p => p.cantidad <= 5).length;
}

function prepararEdicion(id) {
    const p = inventario.find(prod => prod.id === id);
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-cantidad').value = p.cantidad;
    document.getElementById('prod-precio').value = p.precio;
    editandoID = id;
    document.getElementById('btn-main').innerText = "GUARDAR";
    document.getElementById('btn-cancel').style.display = "block";
}

function cancelarEdicion() {
    editandoID = null;
    limpiarCampos();
    document.getElementById('btn-main').innerText = "AGREGAR AL STOCK";
    document.getElementById('btn-cancel').style.display = "none";
}

function limpiarCampos() {
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-cantidad').value = '';
    document.getElementById('prod-precio').value = '';
}

function exportarExcel() {
    let csv = "Producto,Cantidad,Precio,Total\n";
    inventario.forEach(p => csv += `${p.nombre},${p.cantidad},${p.precio},${p.cantidad*p.precio}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'stock.csv');
    a.click();
}

function generarReporteTotales() {
    const total = inventario.reduce((acc, p) => acc + (p.cantidad * p.precio), 0);
    alert(`Total en Stock: $${total.toLocaleString()}`);
}
