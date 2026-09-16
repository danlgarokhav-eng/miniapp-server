let products = [];
let currentIndex = 0;

let favorites = JSON.parse(
    localStorage.getItem("favorites") || "[]"
);

let cart = JSON.parse(
    localStorage.getItem("cart") || "[]"
);


// =========================
// ЗАГРУЗКА ТОВАРОВ
// =========================

async function loadProducts() {
    const card = document.getElementById("card");

    try {
        const response = await fetch("/api/feed");

        if (!response.ok) {
            throw new Error("Ошибка API: " + response.status);
        }

        const data = await response.json();

        console.log("Получен feed:", data);

        if (Array.isArray(data)) {
            products = data;
        } else if (data && Array.isArray(data.items)) {
            products = data.items;
        } else {
            products = [];
        }

        if (!products.length) {
            card.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🛍️</div>
                    <h2>Товаров пока нет</h2>
                    <p>Попробуйте обновить каталог</p>
                </div>
            `;
            return;
        }

        currentIndex = 0;
        render();

    } catch (error) {

        console.error("Ошибка загрузки товаров:", error);

        card.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h2>Не удалось загрузить товары</h2>
                <p>Попробуйте обновить страницу</p>
            </div>
        `;
    }
}


// =========================
// ОТОБРАЖЕНИЕ ТОВАРА
// =========================

function render() {

    const card = document.getElementById("card");

    if (!card || !products.length) {
        return;
    }

    const item = products[currentIndex];

    const name =
        item.name ||
        item.title ||
        "Без названия";

    const brand =
        item.brand ||
        "Без бренда";

    const price =
        item.price !== undefined
            ? item.price
            : 0;

    const rating =
        item.rating !== undefined
            ? item.rating
            : "—";

    const image =
        item.image ||
        (item.images && item.images[0]) ||
        "";

    const link =
        item.link ||
        "#";

    const id =
        item.id !== undefined
            ? item.id
            : currentIndex;

    const isFavorite =
        favorites.includes(String(id));

    card.innerHTML = `
        <div class="product-media">

            ${
                image
                    ? `
                    <img
                        src="${escapeHtml(image)}"
                        class="product-image"
                        onerror="this.style.display='none'"
                    >
                    `
                    : `
                    <div class="no-image">
                        🛍️
                    </div>
                    `
            }

        </div>

        <div class="product-info">

            <div class="product-counter">
                ${currentIndex + 1} / ${products.length}
            </div>

            <div class="product-brand">
                ${escapeHtml(brand)}
            </div>

            <h1 class="product-title">
                ${escapeHtml(name)}
            </h1>

            <div class="product-rating">
                ⭐ ${rating}
            </div>

            <div class="product-bottom">

                <div class="product-price">
                    ${price} $
                </div>

                <button
                    class="favorite-button ${isFavorite ? "active" : ""}"
                    onclick="toggleFavorite()"
                >
                    ${isFavorite ? "❤️" : "♡"}
                </button>

            </div>

            <button
                class="open-product"
                onclick="openProduct()"
            >
                Посмотреть товар
            </button>

        </div>
    `;

    updateCounter();
}


// =========================
// ОТКРЫТЬ ТОВАР
// =========================

function openProduct() {

    if (!products.length) {
        return;
    }

    const item = products[currentIndex];

    if (!item.link) {
        showToast("Ссылка на товар отсутствует");
        return;
    }

    window.open(item.link, "_blank");
}


// =========================
// ИЗБРАННОЕ
// =========================

function toggleFavorite() {

    if (!products.length) {
        return;
    }

    const item = products[currentIndex];

    const id = String(
        item.id !== undefined
            ? item.id
            : currentIndex
    );

    if (favorites.includes(id)) {

        favorites = favorites.filter(
            x => x !== id
        );

        showToast("Удалено из избранного");

    } else {

        favorites.push(id);

        showToast("❤️ Добавлено в избранное");
    }

    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );

    render();
}


// =========================
// КОРЗИНА
// =========================

function addToCart() {

    if (!products.length) {
        return;
    }

    const item = products[currentIndex];

    const id = String(
        item.id !== undefined
            ? item.id
            : currentIndex
    );

    if (!cart.includes(id)) {

        cart.push(id);

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );

        showToast("🛒 Добавлено в корзину");

    } else {

        showToast("Товар уже в корзине");
    }
}


// =========================
// СЛЕДУЮЩИЙ ТОВАР
// =========================

function next() {

    if (!products.length) {
        return;
    }

    currentIndex++;

    if (currentIndex >= products.length) {
        currentIndex = 0;
    }

    animateCard("next");
    render();
}


// =========================
// ПРЕДЫДУЩИЙ ТОВАР
// =========================

function prev() {

    if (!products.length) {
        return;
    }

    currentIndex--;

    if (currentIndex < 0) {
        currentIndex = products.length - 1;
    }

    animateCard("prev");
    render();
}


// =========================
// АНИМАЦИЯ
// =========================

function animateCard(direction) {

    const card = document.getElementById("card");

    if (!card) {
        return;
    }

    card.classList.remove(
        "slide-next",
        "slide-prev"
    );

    void card.offsetWidth;

    if (direction === "next") {
        card.classList.add("slide-next");
    } else {
        card.classList.add("slide-prev");
    }
}


// =========================
// НИЖНЕЕ МЕНЮ
// =========================

function switchTab(button, tab) {

    document
        .querySelectorAll(".nav-item")
        .forEach(item => {
            item.classList.remove("active");
        });

    if (button) {
        button.classList.add("active");
    }

    if (tab === "feed") {

        showToast("Лента");

        return;
    }

    if (tab === "favorites") {

        showFavorites();

        return;
    }

    if (tab === "cart") {

        showCart();

        return;
    }

    if (tab === "profile") {

        showProfile();

        return;
    }
}


// =========================
// ИЗБРАННОЕ — ЭКРАН
// =========================

function showFavorites() {

    if (!favorites.length) {

        showToast("❤️ Избранное пока пустое");

        return;
    }

    showToast(
        `❤️ В избранном: ${favorites.length}`
    );
}


// =========================
// КОРЗИНА — ЭКРАН
// =========================

function showCart() {

    if (!cart.length) {

        showToast("🛒 Корзина пока пустая");

        return;
    }

    showToast(
        `🛒 В корзине: ${cart.length}`
    );
}


// =========================
// ПРОФИЛЬ
// =========================

function showProfile() {

    showToast("👤 Профиль пока в разработке");
}


// =========================
// TOAST
// =========================

function showToast(message) {

    let toast = document.getElementById("toast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 1800);
}


// =========================
// СЧЁТЧИК
// =========================

function updateCounter() {

    const counter =
        document.querySelector(".product-counter");

    if (!counter) {
        return;
    }

    counter.textContent =
        `${currentIndex + 1} / ${products.length}`;
}


// =========================
// SHARE
// =========================

async function shareProduct() {

    if (!products.length) {
        return;
    }

    const item = products[currentIndex];

    const text =
        `${item.name || item.title || "Товар"}\n${item.link || ""}`;

    if (navigator.share) {

        try {

            await navigator.share({
                title: item.name || item.title,
                text: text,
                url: item.link || window.location.href
            });

        } catch (error) {

            console.log("Share отменён");
        }

    } else {

        await navigator.clipboard.writeText(
            item.link || window.location.href
        );

        showToast("🔗 Ссылка скопирована");
    }
}


// =========================
// БЕЗОПАСНЫЙ HTML
// =========================

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================
// SWIPE
// =========================

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", function(event) {

    if (!event.touches.length) {
        return;
    }

    touchStartX =
        event.touches[0].clientX;

});


document.addEventListener("touchend", function(event) {

    if (!event.changedTouches.length) {
        return;
    }

    touchEndX =
        event.changedTouches[0].clientX;

    const difference =
        touchStartX - touchEndX;

    if (Math.abs(difference) < 50) {
        return;
    }

    if (difference > 0) {

        next();

    } else {

        prev();
    }

});


// =========================
// КЛАВИАТУРА
// =========================

document.addEventListener("keydown", function(event) {

    if (event.key === "ArrowRight") {
        next();
    }

    if (event.key === "ArrowLeft") {
        prev();
    }

});


// =========================
// START
// =========================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "StyleFlow Mini App запущен"
        );

        loadProducts();

    }
);
