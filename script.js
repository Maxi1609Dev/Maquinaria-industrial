(function() {
    // ----- BASE DE DATOS DE MÁQUINAS LOCAL -----
    /*const machines = [
      { id: 'm1', name: 'Torno CNC', description: 'Precisión 0.01mm · 5 ejes · 12.000 rpm', price: 18450, icon: 'fa-rotate' },
      { id: 'm2', name: 'Fresadora universal', description: 'Mesas 1200x600mm · cabezal automático', price: 22300, icon: 'fa-wrench' },
      { id: 'm3', name: 'Prensa hidráulica', description: '150 ton · doble brazo · CE', price: 9700, icon: 'fa-gear' },
      { id: 'm4', name: 'Robot de paletización', description: 'Brazo 6 ejes · alcance 2.4m', price: 32750, icon: 'fa-robot' },
      { id: 'm5', name: 'Compresor industrial', description: '500L · 15kW · silencioso', price: 5600, icon: 'fa-compress' },
      { id: 'm6', name: 'Cizalla guillotina', description: 'corte 6mm acero · 3m útil', price: 14990, icon: 'fa-scissors' },
    ];*/

    // ----- BASE DE DATOS DE MÁQUINAS EXTERNA -----
    let machines = [];

      async function loadMachines() {
      const response = await fetch('data/machines.json');
      machines = await response.json();
    }

    // Carrito: array de objetos { id, name, price, quantity }
    let cart = [];

    // Elementos del DOM dinámicos
    const machineGrid = document.getElementById('machineGrid');
    const cartList = document.getElementById('cartList');
    const cartCountSpan = document.getElementById('cartCount');
    const cartTotalSpan = document.getElementById('cartTotal');
    const cartSideTotal = document.getElementById('cartSideTotal');
    const clearCartBtn = document.getElementById('clearCartBtn');

    // Funciones helper: formato euros
    const formatEuro = (value) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // Guardar y cargar desde localStorage (persistencia)
    const STORAGE_KEY = 'industrialMinCart';
    function loadCartFromStorage() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try { cart = JSON.parse(stored); } catch(e) { cart = []; }
      } else {
        cart = [];
      }
    }
    function saveCartToStorage() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    // Calcular totales
    function getTotalItems() {
      return cart.reduce((acc, item) => acc + item.quantity, 0);
    }
    function getTotalPrice() {
      return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }

    // Actualizar todos los contadores y el carrito lateral
    function renderCart() {
      // Actualizar contador superior
      const totalItems = getTotalItems();
      cartCountSpan.textContent = totalItems;
      const totalPrice = getTotalPrice();
      cartTotalSpan.textContent = formatEuro(totalPrice);
      cartSideTotal.textContent = formatEuro(totalPrice);

      // Renderizar items en lateral
      if (cart.length === 0) {
        cartList.innerHTML = `<li class="cart-empty-msg"><i class="fas fa-box-open" style="margin-right:6px;"></i>Carrito vacío</li>`;
      } else {
        let htmlStr = '';
        cart.forEach(item => {
          htmlStr += `<li>
            <div class="cart-item-info">
              <span class="cart-item-title">${item.name}</span>
              <span class="cart-item-price">${formatEuro(item.price)} x ${item.quantity}</span>
            </div>
            <div class="cart-item-actions">
              <button class="decrement-item" data-id="${item.id}" title="Quitar uno">−</button>
              <span style="min-width:20px; text-align:center;">${item.quantity}</span>
              <button class="increment-item" data-id="${item.id}" title="Añadir uno">+</button>
              <button class="remove-item" data-id="${item.id}" title="Eliminar del carrito"><i class="fas fa-times"></i></button>
            </div>
          </li>`;
        });
        cartList.innerHTML = htmlStr;
      }
      // Guardar estado
      saveCartToStorage();
    }

    // Añadir producto al carrito (si existe incrementa)
    function addToCart(productId) {
      const machine = machines.find(m => m.id === productId);
      if (!machine) return;

      const existing = cart.find(item => item.id === productId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          id: machine.id,
          name: machine.name,
          price: machine.price,
          quantity: 1
        });
      }
      renderCart();
    }

    // Eliminar una unidad (decrement)
    function decrementItem(productId) {
      const idx = cart.findIndex(item => item.id === productId);
      if (idx === -1) return;

      if (cart[idx].quantity > 1) {
        cart[idx].quantity -= 1;
      } else {
        cart.splice(idx, 1); // si queda 1 y decrementamos, eliminamos
      }
      renderCart();
    }

    // Incrementar (añadir uno más)
    function incrementItem(productId) {
      const existing = cart.find(item => item.id === productId);
      if (existing) {
        existing.quantity += 1;
      } else {
        // Si no existe (por alguna llamada rara) lo añadimos con quantity 1
        const machine = machines.find(m => m.id === productId);
        if (machine) cart.push({ id: machine.id, name: machine.name, price: machine.price, quantity: 1 });
      }
      renderCart();
    }

    // Eliminar completamente un item
    function removeItemCompletely(productId) {
      cart = cart.filter(item => item.id !== productId);
      renderCart();
    }

    // Vaciar carrito
    function clearCart() {
      cart = [];
      renderCart();
    }

    // Construir catálogo de máquinas
    function renderCatalog() {
      if (!machineGrid) return;
      machineGrid.innerHTML = machines.map(m => {
        return `<div class="machine-card" data-id="${m.id}">
          <div class="machine-icon"><i class="fas ${m.icon}"></i></div>
          <h3>${m.name}</h3>
          <div class="machine-desc">${m.description}</div>
          <div class="price">${formatEuro(m.price)}</div>
          <button class="add-btn" data-id="${m.id}"><i class="fas fa-cart-plus"></i> Añadir</button>
        </div>`;
      }).join('');
    }

    // Event listeners (delegación para botones de máquinas y carrito)
    function setupEventListeners() {
      // Catálogo: click en añadir
      machineGrid.addEventListener('click', (e) => {
        const addButton = e.target.closest('.add-btn');
        if (addButton) {
          const id = addButton.dataset.id;
          if (id) addToCart(id);
          e.preventDefault();
        }
      });

      // Carrito lateral: eventos para incrementar, decrementar, eliminar
      cartList.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const decrementBtn = target.closest('.decrement-item');
        const incrementBtn = target.closest('.increment-item');
        const removeBtn = target.closest('.remove-item'); 

        if (decrementBtn) {
          const id = decrementBtn.dataset.id;
          if (id) decrementItem(id);
        } else if (incrementBtn) {
          const id = incrementBtn.dataset.id;
          if (id) incrementItem(id);
        } else if (removeBtn) {
          const id = removeBtn.dataset.id;
          if (id) removeItemCompletely(id);
        }
        e.stopPropagation();
      });

      // vaciar carrito
      clearCartBtn.addEventListener('click', () => {
        clearCart();
      });

      // Resumen del header también puede mostrar/ocultar (no necesario, pero para móvil podríamos hacer foco)
      // simplemente hacemos scroll suave al carrito lateral en móvil (detalle ergonómico)
      document.querySelector('.cart-summary').addEventListener('click', () => {
        document.getElementById('cartSide').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    // Inicializar: cargar storage, renderizar catalogo y carrito
    /*function init() {
      loadCartFromStorage();
      renderCatalog();
      renderCart();
      setupEventListeners();
    }*/

      async function init() {
        loadCartFromStorage();
        await loadMachines();
        renderCatalog();
        renderCart();
        setupEventListeners();
      }

    init();
  })();