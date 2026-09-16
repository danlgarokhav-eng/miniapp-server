```javascript id="n2p8sj"
let feed = [];

let index = 0;

let startY = 0;
let startX = 0;

let favorites = JSON.parse(
    localStorage.getItem("favorites") || "[]"
);


/* =========================
   LOAD FEED
   ========================= */

async function loadFeed() {

    const card =
        document.getElementById("card");

    try {

        const response =
            await fetch("/api/feed");

        const data =
            await response.json();

        if (Array.isArray(data)) {

            feed = data;

        } else if (
            data &&
            Array.isArray(data.items)
        ) {

            feed = data.items;

        } else {

            feed = [];

        }

    } catch (error) {

        console.error(
            "Ошибка загрузки:",
            error
        );

        feed = [];

    }

    index = 0;

    render();
}


/* =========================
   RENDER
   ========================= */

function render() {

    const card =
        document.getElementById("card");

    if (!feed.length) {

        card.innerHTML = `

            <div class="loading">

                <div style="font-size:40px;">
                    🛍️
                </div>

                <div>
                    Пока нет товаров
                </div>

            </div>

        `;

        return;
    }


    const item =
        feed[index];


    const title =
        item.name ||
        item.title ||
        "Без названия";


    const brand =
        item.brand ||
        "Без бренда";


    const price =
        item.price !== undefined
            ? `${item.price}$`
            : "";


    const rating =
        item.rating !== undefined
            ? `⭐ ${item.rating}`
            : "";


    const image =
        item.image ||
        "";


    const video =
        item.video ||
        "";


    const link =
        item.link ||
        "#";


    const isFavorite =
        favorites.includes(
            item.id
        );


    let mediaHTML = "";


    if (video) {

        mediaHTML = `

            <video
                src="${video}"
                autoplay
                muted
                loop
                playsinline
            ></video>

        `;

    } else if (image) {

        mediaHTML = `

            <img
                src="${image}"
                alt=""
            >

        `;

    } else {

        mediaHTML = `

            <div
                style="
                    font-size:60px;
                    opacity:.5;
                "
            >
                🛍️
            </div>

        `;

    }


    card.innerHTML = `

        <div class="media">

            ${mediaHTML}

        </div>


        <div class="image-gradient"></div>


        <div class="side-actions">

            <button
                class="action-button"
                onclick="toggleFavorite()"
            >
                ${isFavorite ? "❤️" : "🤍"}
            </button>


            <button
                class="action-button"
                onclick="showToast('Добавление в корзину скоро будет доступно')"
            >
                🛒
            </button>


            <button
                class="action-button"
                onclick="shareProduct()"
            >
                ↗
            </button>

        </div>


        <div class="product-info">

            <div class="counter">

                ${index + 1}
                /
                ${feed.length}

            </div>


            <div class="brand">

                ${escapeHTML(brand)}

            </div>


            <div class="title">

                ${escapeHTML(title)}

            </div>


            <div class="meta">

                <div class="price">

                    ${escapeHTML(
                        String(price)
                    )}

                </div>


                ${
                    rating
                        ? `
                            <div class="rating">
                                ${escapeHTML(rating)}
                            </div>
                          `
                        : ""
                }

            </div>


            <button
                class="open-button"
                onclick="openProduct('${escapeAttribute(link)}')"
            >

                Посмотреть товар

            </button>

        </div>

    `;


    addSwipeEvents();

}


/* =========================
   NEXT
   ========================= */

function next() {

    if (!feed.length) {
        return;
    }

    if (index < feed.length - 1) {

        index++;

    } else {

        index = 0;

    }

    animateCard("next");

}


/* =========================
   PREVIOUS
   ========================= */

function prev() {

    if (!feed.length) {
        return;
    }

    if (index > 0) {

        index--;

    } else {

        index = feed.length - 1;

    }

    animateCard("prev");

}


/* =========================
   CARD ANIMATION
   ========================= */

function animateCard(direction) {

    const card =
        document.getElementById("card");

    card.style.opacity = "0";

    card.style.transform =
        direction === "next"
            ? "translateY(35px) scale(.97)"
            : "translateY(-35px) scale(.97)";


    setTimeout(() => {

        render();

        requestAnimationFrame(() => {

            card.style.opacity = "1";

            card.style.transform =
                "translateY(0) scale(1)";

        });

    }, 180);

}


/* =========================
   FAVORITES
   ========================= */

function toggleFavorite() {

    if (!feed.length) {
        return;
    }

    const item =
        feed[index];

    const id =
        item.id ??
        index;


    const position =
        favorites.indexOf(id);


    if (position === -1) {

        favorites.push(id);

        showToast(
            "❤️ Добавлено в избранное"
        );

    } else {

        favorites.splice(
            position,
            1
        );

        showToast(
            "Удалено из избранного"
        );

    }


    localStorage.setItem(
        "favorites",
        JSON.stringify(favorites)
    );


    render();

}


/* =========================
   SHARE
   ========================= */

async function shareProduct() {

    if (!feed.length) {
        return;
    }

    const item =
        feed[index];

    const title =
        item.name ||
        item.title ||
        "Товар";


    const link =
        item.link ||
        window.location.href;


    if (
        navigator.share
    ) {

        try {

            await navigator.share({
                title: title,
                url: link
            });

        } catch (error) {

            // пользователь закрыл окно

        }

    } else {

        try {

            await navigator.clipboard.writeText(
                link
            );

            showToast(
                "🔗 Ссылка скопирована"
            );

        } catch (error) {

            showToast(
                "Ссылку не удалось скопировать"
            );

        }

    }

}


/* =========================
   OPEN PRODUCT
   ========================= */

function openProduct(link) {

    if (
        !link ||
        link === "#"
    ) {

        showToast(
            "Ссылка на товар отсутствует"
        );

        return;

    }


    window.open(
        link,
        "_blank"
    );

}


/* =========================
   NAVIGATION
   ========================= */

function switchTab(
    button,
    tab
) {

    document
        .querySelectorAll(".nav-item")
        .forEach(item => {

            item.classList.remove(
                "active"
            );

        });


    button.classList.add(
        "active"
    );


    if (tab === "feed") {

        showToast(
            "🏠 Лента"
        );

        return;

    }


    if (tab === "favorites") {

        showToast(
            `❤️ Избранное: ${favorites.length}`
        );

        return;

    }


    if (tab === "cart") {

        showToast(
            "🛒 Корзина пока пустая"
        );

        return;

    }


    if (tab === "profile") {

        showToast(
            "👤 Профиль скоро будет доступен"
        );

    }

}


/* =========================
   TOAST
   ========================= */

let toastTimer = null;


function showToast(
    text
) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        text;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 1800);

}


/* =========================
   SWIPE
   ========================= */

function addSwipeEvents() {

    const card =
        document.getElementById(
            "card"
        );


    card.ontouchstart =
        function(event) {

            const touch =
                event.changedTouches[0];

            startY =
                touch.clientY;

            startX =
                touch.clientX;

        };


    card.ontouchend =
        function(event) {

            const touch =
                event.changedTouches[0];

            const diffY =
                touch.clientY - startY;

            const diffX =
                touch.clientX - startX;


            // горизонтальный свайп
            if (
                Math.abs(diffX) >
                Math.abs(diffY)
            ) {

                return;

            }


            if (
                Math.abs(diffY) < 50
            ) {

                return;

            }


            if (
                diffY < 0
            ) {

                next();

            } else {

                prev();

            }

        };

}


/* =========================
   KEYBOARD
   ========================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "ArrowDown"
        ) {

            next();

        }


        if (
            event.key ===
            "ArrowUp"
        ) {

            prev();

        }

    }
);


/* =========================
   HELPERS
   ========================= */

function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(
    value
) {

    return String(value)
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );

}


/* =========================
   START
   ========================= */

loadFeed();
```
