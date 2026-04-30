// --- CONFIGURACIÓN DE SUPABASE ---
const URL_DB = 'https://bawhnopbfygbyimuoqjh.supabase.co';
const KEY_DB = 'sb_publishable_wppuPKcVUdVrVFe9A-VYDw_9kL-B8me';
const instanciaSupabase = window.supabase.createClient(URL_DB, KEY_DB);

let inventario = [];
let editandoID = null;
let currentUser = null;

// --- GESTIÓN DE SESIÓN Y LICENCIA (REPARADA PARA NO CERRARSE) ---
instanciaSupabase.auth.onAuthStateChange(async (event, session) => {
    const authContainer = document.getElementById('auth-container');
    const mainContent = document.getElementById('main-content');
    const userDisplay = document.getElementById('user-display');

    if (session) {
        currentUser = session.user;
        
        // Verificamos licencia silenciosamente
        try {
            const { data, error } = await instanciaSupabase
                .from('clientes_autorizados')
                .select('activo')
                .eq('email', currentUser.email)
                .maybeSingle();

            if (data && data.activo === true) {
                // TODO OK: Entramos al sistema
                if(authContainer) authContainer.style.display = 'none';
                if(mainContent) mainContent.style.display = 'block';
                if(userDisplay) userDisplay.innerText = `SALIR (${currentUser.email})`;
                cargarDatosSupabase();
            } else if (data && data.activo === false) {
                alert("⚠️ LICENCIA INACTIVA: Contactá a soporte.");
                await instanciaSupabase.auth.signOut();
            }
            // Si error o !data, no hacemos nada para evitar que te saque por lag de conexión
        } catch (e) {
            console.log("Error de verificación momentáneo, reintentando...");
        }
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

async function register() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const { error } = await instanciaSupabase.auth.signUp({ email, password });
    if (error) alert("Error: " + error.message);
    else alert("Registro enviado. Si el login falla, avisale al admin que te active.");
}

async function logout() {
    await instanciaSupabase.auth.signOut();
}

// --- LÓGICA DE INVENTARIO (REPARADA) ---
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
    const nombre = document.getElementById('prod-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('prod-cantidad').value);
    const precio = parseFloat(document.getElementById('prod-precio').value);

    if (!nombre || isNaN(cantidad) || isNaN(precio)) return alert("Completá los campos.");

    if (editandoID) {
        await instanciaSupabase.from('productos').update({ 
            nombre: nombre.toUpperCase(), cantidad, precio 
        }).eq('id', editandoID);
        cancelarEdicion();
    } else {
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

// --- TERMINAL DE VENTAS (NUEVA Y FUNCIONAL) ---
function ejecutarComando(event) {
    const input = document.getElementById('console-input');
    const valor = input.value.trim().toUpperCase();
    if (!valor) return;

    const partes = valor.split(" ");
    const cant = parseInt(partes[0]);
    const nombreProd = partes.slice(1).join(" ");

    if (isNaN(cant) || !nombreProd) {
        agregarLogTerminal("Usa: 3 YERBA", "#ef4444");
    } else {
        const producto = inventario.find(p => p.nombre === nombreProd);
        if (producto) {
            if (producto.cantidad >= cant) {
                hacerVentaRapida(producto.id, producto.cantidad - cant, cant, nombreProd);
            } else {
                agregarLogTerminal("Stock insuficiente", "#ef4444");
            }
        } else {
            agregarLogTerminal("No encontrado", "#fbbf24");
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
    const entry = document.createElement('div');
    entry.style.color = color;
    entry.innerText = `> ${mensaje}`;
    log.prepend(entry);
}

function toggleConsole() {
    const body = document.getElementById('console-body');
    const icon = document.getElementById('console-icon');
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
    icon.className = body.style.display === 'none' ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

// --- OTRAS FUNCIONES ---
async function registrarVenta(id) {
    const input = document.getElementById(`venta-${id}`);
    const cant = parseInt(input.value);
    const p = inventario.find(prod => prod.id === id);
    if (isNaN(cant) || cant <= 0 || cant > p.cantidad) return alert("Cantidad inválida");

    await instanciaSupabase.from('productos').update({ cantidad: p.cantidad - cant }).eq('id', id);
    await cargarDatosSupabase();
}

async function eliminarProducto(id) {
    if (confirm("¿Eliminar producto?")) {
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
    document.getElementById('count-total').innerText = inventario.length;
    document.getElementById('count-low').innerText = inventario.filter(p => p.cantidad <= 5).length;
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

function exportarExcel() {
    let csv = "Producto,Stock,Precio,Valor Total\n";
    inventario.forEach(p => csv += `${p.nombre},${p.cantidad},${p.precio},${p.cantidad*p.precio}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock.csv';
    a.click();
}

function generarReporteTotales() {
    const total = inventario.reduce((acc, p) => acc + (p.cantidad * p.precio), 0);
    alert(`VALOR TOTAL DEL INVENTARIO: $${total.toLocaleString()}`);
}
