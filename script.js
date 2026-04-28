// --- CONFIGURACIÓN DE SUPABASE ---
const URL_DB = 'https://bawhnopbfygbyimuoqjh.supabase.co';
const KEY_DB = 'sb_publishable_wppuPKcVUdVrVFe9A-VYDw_9kL-B8me';
const instanciaSupabase = window.supabase.createClient(URL_DB, KEY_DB);

let inventario = [];
let editandoID = null;
let currentUser = null;

// --- GESTIÓN DE SESIÓN Y LICENCIA ---
instanciaSupabase.auth.onAuthStateChange(async (event, session) => {
    const authContainer = document.getElementById('auth-container');
    const mainContent = document.getElementById('main-content');
    const userDisplay = document.getElementById('user-display');

    if (session) {
        // VERIFICACIÓN DE LICENCIA
        const { data, error } = await instanciaSupabase
            .from('clientes_autorizados')
            .select('activo')
            .eq('email', session.user.email)
            .single();

        if (error || !data || data.activo === false) {
            alert("⚠️ LICENCIA NO ACTIVA: Tu cuenta no tiene acceso a PATRIC SOFT ®. Contactá al soporte.");
            await instanciaSupabase.auth.signOut(); // Lo expulsamos
            return;
        }

        // Si pasó la prueba, entra al sistema
        currentUser = session.user;
        if(authContainer) authContainer.style.display = 'none';
        if(mainContent) mainContent.style.display = 'block';
        if(userDisplay) userDisplay.innerText = `SALIR (${currentUser.email})`;
        cargarDatosSupabase();
    } else {
        currentUser = null;
        if(authContainer) authContainer.style.display = 'flex';
        if(mainContent) mainContent.style.display = 'none';
    }
});

// --- FUNCIONES DE AUTENTICACIÓN ---
async function login() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const { error } = await instanciaSupabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error al ingresar: " + error.message);
}

async function register() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const { error } = await instanciaSupabase.auth.signUp({ email, password });
    if (error) alert("Error al registrarse: " + error.message);
    else alert("¡Registro exitoso! Ya podés iniciar sesión.");
}

async function logout() {
    await instanciaSupabase.auth.signOut();
}

// --- LÓGICA DE INVENTARIO ---
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

    if (!nombre || isNaN(cantidad) || isNaN(precio)) return alert("Completá todos los campos.");

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
                <input type="number" id="venta-${p.id}" placeholder="0" style="width:50px">
                <button class="btn-sell" onclick="registrarVenta(${p.id})">
                    <i class="fas fa-check"></i>
                </button>
            </td>
            <td style="color:#22c55e; font-weight:bold;">
                $${(p.cantidad * p.precio).toLocaleString()}
            </td>
            <td>
                <button class="btn-action edit" onclick="prepararEdicion(${p.id})">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn-action delete" onclick="eliminarProducto(${p.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// --- NUEVAS FUNCIONES DE REPORTES ---

function exportarExcel() {
    if (inventario.length === 0) return alert("No hay datos para exportar.");
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Producto,Cantidad,Precio Unitario,Valor Total\n";
    
    inventario.forEach(p => {
        let fila = `${p.nombre},${p.cantidad},${p.precio},${p.cantidad * p.precio}`;
        csvContent += fila + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventario_patric_soft.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generarReporteTotales() {
    const totalProductos = inventario.length;
    const valorTotalInvertido = inventario.reduce((acc, p) => acc + (p.cantidad * p.precio), 0);
    const productosBajoStock = inventario.filter(p => p.cantidad <= 5).length;

    alert(`--- REPORTE PATRIC SOFT ® ---\n\n` +
          `Total de artículos distintos: ${totalProductos}\n` +
          `Valor total del inventario: $${valorTotalInvertido.toLocaleString()}\n` +
          `Productos en alerta (Stock bajo): ${productosBajoStock}\n\n` +
          `¡Seguí así, el negocio viene bien!`);
}

// --- RESTO DE FUNCIONES (ELIMINAR, EDITAR, ETC) ---

async function registrarVenta(id) {
    const inputVenta = document.getElementById(`venta-${id}`);
    const cantVenta = parseInt(inputVenta.value);
    const producto = inventario.find(p => p.id === id);
    
    if (isNaN(cantVenta) || cantVenta <= 0 || cantVenta > producto.cantidad) {
        return alert("Cantidad de venta inválida.");
    }

    const { error } = await instanciaSupabase
        .from('productos')
        .update({ cantidad: producto.cantidad - cantVenta })
        .eq('id', id);

    if (!error) await cargarDatosSupabase();
}

async function eliminarProducto(id) {
    if (confirm("¿Seguro que querés eliminar este producto?")) {
        await instanciaSupabase.from('productos').delete().eq('id', id);
        await cargarDatosSupabase();
    }
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
}

function cancelarEdicion() {
    editandoID = null;
    limpiarCampos();
    document.getElementById('form-title').innerText = "Nuevo Producto";
    document.getElementById('btn-main').innerText = "AGREGAR AL STOCK";
    document.getElementById('btn-cancel').style.display = "none";
}
