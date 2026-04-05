
let inventario = JSON.parse(sessionStorage.getItem('stock_data')) || [];
let editandoID = null;

document.addEventListener('DOMContentLoaded', () => {
    renderizarTabla();
    actualizarContadores();
});

function procesarProducto() {
    const nombre = document.getElementById('prod-nombre').value.trim();
    const cantidad = parseInt(document.getElementById('prod-cantidad').value);
    const precio = parseFloat(document.getElementById('prod-precio').value);

    if (!nombre || isNaN(cantidad) || isNaN(precio)) {
        alert("Completá todos los campos.");
        return;
    }

    if (editandoID) {
        inventario = inventario.map(p => p.id === editandoID ? 
            { ...p, nombre: nombre.toUpperCase(), cantidad, precio } : p
        );
        cancelarEdicion();
    } else {
        inventario.push({ id: Date.now(), nombre: nombre.toUpperCase(), cantidad, precio });
    }

    guardarYActualizar();
    limpiarCampos();
}

function registrarVenta(id) {
    const inputVenta = document.getElementById(`venta-${id}`);
    const cantVenta = parseInt(inputVenta.value);
    const producto = inventario.find(p => p.id === id);

    if (isNaN(cantVenta) || cantVenta <= 0 || cantVenta > producto.cantidad) {
        alert("Cantidad no válida.");
        return;
    }

    producto.cantidad -= cantVenta;
    inputVenta.value = '';
    guardarYActualizar();
}

function ejecutarComando(event) {
    if (event.key === 'Enter') {
        const input = document.getElementById('console-input');
        const valor = input.value.trim().toUpperCase();
        const partes = valor.match(/^(\d+)\s+(.+)$/);

        if (!partes) {
            escribirLog("ERROR: Formato '3 NOMBRE'", "#ef4444");
        } else {
            const cant = parseInt(partes[1]);
            const prod = inventario.find(p => p.nombre.includes(partes[2]));

            if (prod && prod.cantidad >= cant) {
                prod.cantidad -= cant;
                escribirLog(`VENDIDO: ${cant} x ${prod.nombre}`, "#22c55e");
                guardarYActualizar();
            } else {
                escribirLog("ERROR: No encontrado o sin stock", "#ef4444");
            }
        }
        input.value = '';
    }
}

function escribirLog(msg, color) {
    const log = document.getElementById('console-log');
    const div = document.createElement('div');
    div.style.color = color;
    div.innerText = `> ${msg}`;
    log.prepend(div);
}

function toggleConsole() {
    const body = document.getElementById('console-body');
    const icon = document.getElementById('console-icon');
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    icon.classList.replace(isHidden ? 'fa-chevron-up' : 'fa-chevron-down', isHidden ? 'fa-chevron-down' : 'fa-chevron-up');
    if (isHidden) document.getElementById('console-input').focus();
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

function eliminarProducto(id) {
    if (confirm("¿Eliminar de PATRIC SOFT ®?")) {
        inventario = inventario.filter(p => p.id !== id);
        guardarYActualizar();
    }
}

function guardarYActualizar() {
    // MODIFICADO: Solo guardamos en la sesión temporal del navegador
    sessionStorage.setItem('stock_data', JSON.stringify(inventario));
    renderizarTabla();
    actualizarContadores();
}

function renderizarTabla(data = inventario) {
    const tbody = document.getElementById('lista-stock');
    tbody.innerHTML = '';
    data.forEach(p => {
        const fila = document.createElement('tr');
        if (p.cantidad <= 5) fila.className = 'low-stock';
        fila.innerHTML = `
            <td>${p.nombre}</td>
            <td><strong>${p.cantidad} u.</strong></td>
            <td>$${p.precio.toLocaleString()}</td>
            <td><input type="number" id="venta-${p.id}" style="width:60px"> <button class="btn-sell" onclick="registrarVenta(${p.id})"><i class="fas fa-check"></i></button></td>
            <td style="color:#22c55e">$${(p.cantidad * p.precio).toLocaleString()}</td>
            <td><button class="btn-action edit" onclick="prepararEdicion(${p.id})"><i class="fas fa-pen"></i></button><button class="btn-action delete" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(fila);
    });
}

function filtrarProductos() {
    const busqueda = document.getElementById('search-input').value.toUpperCase();
    renderizarTabla(inventario.filter(p => p.nombre.includes(busqueda)));
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
