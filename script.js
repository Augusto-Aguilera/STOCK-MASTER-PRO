// --- CONFIGURACIÓN DE SUPABASE ---
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
        currentUser = session.user;
        
        // Mostrar panel principal
        if(authContainer) authContainer.style.display = 'none';
        if(mainContent) mainContent.style.display = 'block';
        
        // Actualizar texto del botón de salida
        if(userDisplay) {
            userDisplay.innerHTML = `<i class="fas fa-sign-out-alt"></i> SALIR (${currentUser.email})`;
            // Nos aseguramos de que el clic funcione
            userDisplay.onclick = logout; 
        }

        cargarDatosSupabase();
    } else {
        currentUser = null;
        if(authContainer) authContainer.style.display = 'flex';
        if(mainContent) mainContent.style.display = 'none';
    }
});

// --- FUNCIONES DE AUTENTICACIÓN ---
async function login() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const { error } = await instanciaSupabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error al ingresar: " + error.message);
}

async function logout() {
    const { error } = await instanciaSupabase.auth.signOut();
    if (error) console.error("Error al salir:", error.message);
}

// --- LÓGICA DE PRODUCTOS (CARGA Y GUARDADO) ---
async function cargarDatosSupabase() {
    if (!currentUser) return;
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
    const nombreInput = document.getElementById('prod-nombre');
    const cantidadInput = document.getElementById('prod-cantidad');
    const precioInput = document.getElementById('prod-precio');

    const nombre = nombreInput.value.trim();
    const cantidad = parseInt(cantidadInput.value);
    const precio = parseFloat(precioInput.value);

    if (!nombre || isNaN(cantidad) || isNaN(precio)) {
        alert("Por favor, completa nombre, cantidad y precio.");
        return;
    }

    try {
        if (editandoID) {
            const { error } = await instanciaSupabase.from('productos')
                .update({ nombre: nombre.toUpperCase(), cantidad, precio })
                .eq('id', editandoID);
            if(error) throw error;
            cancelarEdicion();
        } else {
            const { error } = await instanciaSupabase.from('productos')
                .insert([{ 
                    nombre: nombre.toUpperCase(), 
                    cantidad: cantidad, 
                    precio: precio, 
                    user_id: currentUser.id 
                }]);
            if(error) throw error;
        }
        
        limpiarCampos();
        await cargarDatosSupabase();
        alert("¡Producto guardado con éxito!");
    } catch (err) {
        console.error(err);
        alert("Error en la base de datos: " + err.message);
    }
}

// --- RENDERIZADO Y UI ---
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
                <input type="number" id="venta-${p.id}" placeholder="0" style="width:60px; padding:5px">
                <button class="btn-sell" onclick="registrarVenta(${p.id})"><i class="fas fa-check"></i></button>
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

// --- TERMINAL DE VENTAS ---
function ejecutarComando(event) {
    if (event.key !== 'Enter') return;
    const input = document.getElementById('console-input');
    const valor = input.value.trim().toUpperCase();
    if (!valor) return;

    const partes = valor.split(" ");
    const cant = parseInt(partes[0]);
    const nombreProd = partes.slice(1).join(" ");

    if (isNaN(cant) || !nombreProd) {
        agregarLogTerminal("Usa el formato: 3 YERBA", "#ef4444");
    } else {
        const producto = inventario.find(p => p.nombre === nombreProd);
        if (producto) {
            if (producto.cantidad >= cant) {
                hacerVentaRapida(producto.id, producto.cantidad - cant, cant, nombreProd);
            } else {
                agregarLogTerminal("Stock insuficiente", "#ef4444");
            }
        } else {
            agregarLogTerminal(`"${nombreProd}" no existe`, "#fbbf24");
        }
    }
    input.value = "";
}

async function hacerVentaRapida(id, nuevaCant, cantVendida, nombre) {
    const { error } = await instanciaSupabase.from('productos').update({ cantidad: nuevaCant }).eq('id', id);
    if (!error) {
        agregarLogTerminal(`Vendido ${cantVendida} x ${nombre}`, "#22c55e");
        await cargarDatosSupabase();
    }
}

function agregarLogTerminal(mensaje, color) {
    const log = document.getElementById('console-log');
    if(!log) return;
    const entry = document.createElement('div');
    entry.style.color = color;
    entry.innerText = `> ${mensaje}`;
    log.prepend(entry);
}

// --- FUNCIONES ADICIONALES ---
async function registrarVenta(id) {
    const input = document.getElementById(`venta-${id}`);
    const cant = parseInt(input.value);
    const p = inventario.find(prod => prod.id === id);
    if (isNaN(cant) || cant <= 0 || cant > p.cantidad) return alert("Cantidad inválida");

    await instanciaSupabase.from('productos').update({ cantidad: p.cantidad - cant }).eq('id', id);
    await cargarDatosSupabase();
}

async function eliminarProducto(id) {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
        await instanciaSupabase.from('productos').delete().eq('id', id);
        await cargarDatosSupabase();
    }
}

function filtrarProductos() {
    const term = document.getElementById('search-input').value.toUpperCase();
    const filas = document.querySelectorAll('#lista-stock tr');
    filas.forEach(f => f.style.display = f.innerText.toUpperCase().includes(term) ? '' : 'none');
}

function actualizarContadores() {
    const totalElement = document.getElementById('count-total');
    const lowElement = document.getElementById('count-low');
    if(totalElement) totalElement.innerText = inventario.length;
    if(lowElement) lowElement.innerText = inventario.filter(p => p.cantidad <= 5).length;
}

function limpiarCampos() {
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-cantidad').value = '';
    document.getElementById('prod-precio').value = '';
}

function prepararEdicion(id) {
    const p = inventario.find(prod => prod.id === id);
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-cantidad').value = p.cantidad;
    document.getElementById('prod-precio').value = p.precio;
    editandoID = id;
    document.getElementById('form-title').innerText = "Editando Producto";
    document.getElementById('btn-main').innerText = "GUARDAR CAMBIOS";
    document.getElementById('btn-cancel').style.display = "block";
    window.scrollTo(0,0);
}

function cancelarEdicion() {
    editandoID = null;
    limpiarCampos();
    document.getElementById('form-title').innerText = "Nuevo Producto";
    document.getElementById('btn-main').innerText = "AGREGAR AL STOCK";
    document.getElementById('btn-cancel').style.display = "none";
}

function toggleConsole() {
    const body = document.getElementById('console-body');
    if(!body) return;
    body.style.display = (body.style.display === 'none' || body.style.display === '') ? 'block' : 'none';
}
