let feed = [];
let index = 0;
let isAnimating = false;

const card = document.getElementById("card");

async function loadFeed() {
    try {
        const res = await fetch("/api/feed", {
            cache: "no-store"
        });

        if (!res.ok) {
            throw new Error("Ошибка загрузки фида");
        }

        const data = await res.json();

        if (Array.isArray(data)) {
            feed = data;
        } else if (data && Array.isArray(data.items)) {
            feed = data.items;
        } else {
            feed = [];
        }

        index = 0;

        render();

    } catch (error) {
        console.error(error);

        card.innerHTML = `
            <div class="empty">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Не удалось загрузить товары</div>
                <div class="empty-text">Попробуйте обновить страницу</div>
            </div>
        `;
    }
}


function render(direction = "none") {

    if (!feed.length) {
        card.innerHTML = `
            <div class="empty">
                <div class="empty-icon">🛍️</div>
                <div class="empty-title">Товаров пока нет</div>
                <div class="empty-text">
                    Запусти поиск товаров через бота
                </div>
            </div>
        `;

        return;
    }

    const item = feed[index];

    const title =
        item.name ||
        item.title ||
        "Без названия";

    const brand =
        item.brand ||
        "Без бренда";

    const price =
        item.price !== undefined &&
        item.price !== null
            ? `${item.price} ₽`
            : "";

    const rating =
        item.rating
            ? `⭐ ${item.rating}`
            : "";

    const image =
        item.image ||
        (item.images && item.images.length
            ? item.images[0]
            : "");

    const link =
        item.link || "#";


    let mediaHTML;

    if (image) {

        mediaHTML = `
            <img
                src="${image}"
                alt="${escapeHTML(title)}"
                loading="eager"
                onerror="this.style.display='none'; this.parentElement.classList.add('image-error')"
            >
        `;

    } else {

        mediaHTML = `
            <div class="no-image">
                🛍️
            </div>
        `;
    }


    card.innerHTML = `
        <div class="product-card ${direction !== "none" ? "animate-" + direction : ""}">

            <div class="product-image">
                ${mediaHTML}

                <div class="counter">
                    ${index + 1} / ${feed.length}
                </div>
            </div>

            <div class="product-info">

                <div class="product-brand">
                    ${escapeHTML(brand)}
                </div>

                <div class="product-title">
                    ${escapeHTML(title)}
                </div>

                <div class="product-bottom">

                    <div>
                        <div class="product-price">
                            ${price}
                        </div>

                        ${
                            rating
                                ? `<div class="product-rating">${rating}</div>`
                                : ""
                        }
                    </div>

                    <a
                        class="open-button"
                        href="${link}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Открыть →
                    </a>

                </div>

            </div>

        </div>
    `;
}


function next() {

    if (!feed.length || isAnimating) {
        return;
    }

    if (index >= feed.length - 1) {
        index = 0;
    } else {
        index++;
    }

    render("next");
}


function prev() {

    if (!feed.length || isAnimating) {
        return;
    }

    if (index <= 0) {
        index = feed.length - 1;
    } else {
        index--;
    }

    render("prev");
}


function escapeHTML(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   КНОПКИ
========================= */

document.addEventListener("click", function(event) {

    const nextButton =
        event.target.closest(".btn-next");

    const prevButton =
        event.target.closest(".btn-prev");

    if (nextButton) {
        next();
    }

    if (prevButton) {
        prev();
    }

});


/* =========================
   КЛАВИАТУРА
========================= */

document.addEventListener("keydown", function(event) {

    if (event.key === "ArrowDown" ||
        event.key === "ArrowRight") {

        next();
    }

    if (event.key === "ArrowUp" ||
        event.key === "ArrowLeft") {

        prev();
    }

});


/* =========================
   СВАЙП
========================= */

let touchStartY = 0;
let touchStartX = 0;

document.addEventListener(
    "touchstart",
    function(event) {

        const touch = event.changedTouches[0];

        touchStartY = touch.clientY;
        touchStartX = touch.clientX;

    },
    { passive: true }
);


document.addEventListener(
    "touchend",
    function(event) {

        const touch = event.changedTouches[0];

        const deltaY =
            touchStartY - touch.clientY;

        const deltaX =
            touchStartX - touch.clientX;


        /*
         * Вертикальный свайп должен
         * быть сильнее горизонтального.
         */

        if (
            Math.abs(deltaY) > 50 &&
            Math.abs(deltaY) > Math.abs(deltaX)
        ) {

            if (deltaY > 0) {
                next();
            } else {
                prev();
            }
        }

    },
    { passive: true }
);


/* =========================
   ЗАПУСК
========================= */

loadFeed();
