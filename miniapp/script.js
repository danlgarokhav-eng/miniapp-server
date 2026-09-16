let allProducts = [];
let products = [];

let currentIndex = 0;

let favorites = JSON.parse(
    localStorage.getItem("favorites") || "[]"
);

let currentTab = "feed";

let startY = 0;
let currentY = 0;

let startX = 0;
let currentX = 0;

let dragging = false;

let touchCount = 0;

let lastTap = 0;


// =====================================
// LOAD
// =====================================

async function loadProducts() {

    try {

        const response =
            await fetch("/api/feed");

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }

        const data =
            await response.json();

        if (Array.isArray(data)) {

            allProducts = data;

        } else if (
            data &&
            Array.isArray(data.items)
        ) {

            allProducts = data.items;

        } else {

            allProducts = [];
        }


        products = allProducts;

        localStorage.setItem(
            "main_feed",
            JSON.stringify(allProducts)
        );


        if (!products.length) {

            showEmpty(
                "🛍️",
                "Товаров пока нет",
                "Попробуйте обновить каталог"
            );

            return;
        }


        currentIndex = 0;

        render();

    } catch (error) {

        console.error(
            "Ошибка загрузки:",
            error
        );

        showEmpty(
            "⚠️",
            "Ошибка загрузки",
            "Не удалось получить товары"
        );
    }
}


// =====================================
// RENDER
// =====================================

function render() {

    const card =
        document.getElementById("card");

    if (!card) {
        return;
    }


    if (!products.length) {

        showEmpty(
            "❤️",
            "Здесь пока пусто",
            "Добавьте понравившиеся товары"
        );

        return;
    }


    if (currentIndex >= products.length) {

        currentIndex =
            products.length - 1;
    }


    const item =
        products[currentIndex];


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
        (
            item.images &&
            item.images.length
                ? item.images[0]
                : ""
        );


    const liked =
        isFavorite(item);


    card.innerHTML = `

        <div class="product-media">

            ${
                image
                    ? `
                        <img
                            src="${escapeHtml(image)}"
                            class="product-image"
                            draggable="false"
                            onerror="
                                this.style.display='none'
                            "
                        >
                    `
                    :
                    `
                        <div class="no-image">
                            🛍️
                        </div>
                    `
            }

        </div>


        <div class="product-info">

            <div class="product-brand">
                ${escapeHtml(brand)}
            </div>


            <h1 class="product-title">
                ${escapeHtml(name)}
            </h1>


            <div class="product-rating">
                ⭐ ${rating}
            </div>


            <div class="product-price">
                ${price} $
            </div>


            <button
                class="open-product"
                onclick="openProduct(event)"
            >
                Открыть товар ↗
            </button>


            <div class="product-counter">
                ${currentIndex + 1}
                /
                ${products.length}
            </div>

        </div>
    `;


    updateLikeButton(liked);
}


// =====================================
// LIKE
// =====================================

function toggleFavorite(event) {

    if (event) {
        event.stopPropagation();
    }


    if (!products.length) {
        return;
    }


    const item =
        products[currentIndex];


    const id =
        getProductId(item);


    const existing =
        favorites.findIndex(
            product =>
                String(product.id) === id
        );


    if (existing !== -1) {

        favorites.splice(
            existing,
            1
        );

        showToast(
            "Удалено из избранного"
        );

    } else {

        favorites.push({
            ...item,
            id: id
        });

        showToast(
            "❤️ Добавлено в избранное"
        );

        playHeart();
    }


    saveFavorites();

    updateLikeButton(
        existing === -1
    );
}


// =====================================
// LIKE BUTTON
// =====================================

function updateLikeButton(liked) {

    const button =
        document.getElementById(
            "likeButton"
        );

    if (!button) {
        return;
    }


    const icon =
        button.querySelector(
            ".action-icon"
        );


    if (liked) {

        button.classList.add(
            "active"
        );

        icon.textContent = "❤️";

    } else {

        button.classList.remove(
            "active"
        );

        icon.textContent = "♡";
    }
}


// =====================================
// HEART ANIMATION
// =====================================

function playHeart() {

    const heart =
        document.getElementById(
            "bigHeart"
        );


    heart.classList.remove(
        "show"
    );


    void heart.offsetWidth;


    heart.classList.add(
        "show"
    );
}


// =====================================
// ID
// =====================================

function getProductId(item) {

    if (
        item.id !== undefined &&
        item.id !== null
    ) {

        return String(item.id);
    }


    return String(
        item.link ||
        item.name ||
        item.title ||
        Math.random()
    );
}


// =====================================
// IS FAVORITE
// =====================================

function isFavorite(item) {

    const id =
        getProductId(item);


    return favorites.some(
        product =>
            String(product.id) === id
    );
}


// =====================================
// SAVE
// =====================================

function saveFavorites() {

    localStorage.setItem(
        "favorites",
        JSON.stringify(
            favorites
        )
    );
}


// =====================================
// OPEN PRODUCT
// =====================================

function openProduct(event) {

    if (event) {
        event.stopPropagation();
    }


    if (!products.length) {
        return;
    }


    const item =
        products[currentIndex];


    if (!item.link) {

        showToast(
            "Ссылка на товар отсутствует"
        );

        return;
    }


    window.open(
        item.link,
        "_blank"
    );
}


// =====================================
// VERTICAL SWIPE
// =====================================

document.addEventListener(
    "touchstart",
    function(event) {

        if (
            event.target.closest(
                "button"
            )
        ) {
            return;
        }


        if (!event.touches.length) {
            return;
        }


        touchCount =
            event.touches.length;


        startY =
            event.touches[0].clientY;


        currentY =
            startY;


        startX =
            event.touches[0].clientX;


        currentX =
            startX;


        dragging = true;


        const card =
            document.getElementById(
                "card"
            );


        if (card) {

            card.style.transition =
                "none";
        }

    },
    {
        passive: true
    }
);


// =====================================
// TOUCH MOVE
// =====================================

document.addEventListener(
    "touchmove",
    function(event) {

        if (!dragging) {
            return;
        }


        if (!event.touches.length) {
            return;
        }


        currentY =
            event.touches[0].clientY;


        currentX =
            event.touches[0].clientX;


        const diff =
            currentY - startY;


        const card =
            document.getElementById(
                "card"
            );


        if (!card) {
            return;
        }


        const rotation =
            -(diff / 25);


        card.style.transform =
            `
                translateY(${diff}px)
                rotate(${rotation}deg)
            `;
    },
    {
        passive: true
    }
);


// =====================================
// TOUCH END
// =====================================

document.addEventListener(
    "touchend",
    function() {

        if (!dragging) {
            return;
        }


        dragging = false;


        const card =
            document.getElementById(
                "card"
            );


        if (!card) {
            return;
        }


        const diff =
            currentY - startY;


        const threshold =
            Math.min(
                130,
                window.innerHeight * .18
            );


        card.style.transition =
            "transform .35s cubic-bezier(.22,.61,.36,1)";


        if (
            Math.abs(diff) >
            threshold
        ) {


            if (diff < 0) {

                // свайп вверх

                card.style.transform =
                    `
                        translateY(-120%)
                        rotate(-5deg)
                    `;


                setTimeout(
                    () => {

                        nextProduct();

                        resetCard();

                    },
                    260
                );


            } else {

                // свайп вниз

                card.style.transform =
                    `
                        translateY(120%)
                        rotate(5deg)
                    `;


                setTimeout(
                    () => {

                        previousProduct();

                        resetCard();

                    },
                    260
                );
            }


        } else {

            resetCard();
        }


        // двойной тап
        checkDoubleTap();

    }
);


// =====================================
// RESET CARD
// =====================================

function resetCard() {

    const card =
        document.getElementById(
            "card"
        );


    if (!card) {
        return;
    }


    card.style.transition =
        "none";


    card.style.transform =
        "translateY(0) rotate(0)";


    requestAnimationFrame(
        () => {

            card.style.transition =
                "transform .35s cubic-bezier(.22,.61,.36,1)";
        }
    );
}


// =====================================
// NEXT
// =====================================

function nextProduct() {

    if (!products.length) {
        return;
    }


    currentIndex++;


    if (
        currentIndex >=
        products.length
    ) {

        currentIndex = 0;
    }


    render();
}


// =====================================
// PREVIOUS
// =====================================

function previousProduct() {

    if (!products.length) {
        return;
    }


    currentIndex--;


    if (currentIndex < 0) {

        currentIndex =
            products.length - 1;
    }


    render();
}


// =====================================
// DOUBLE TAP
// =====================================

function checkDoubleTap() {

    const now =
        Date.now();


    const difference =
        now - lastTap;


    if (
        difference > 0 &&
        difference < 350
    ) {

        toggleFavorite();

    }


    lastTap = now;
}


// =====================================
// MOUSE WHEEL
// =====================================

let wheelLocked = false;


document.addEventListener(
    "wheel",
    function(event) {

        if (
            currentTab !== "feed"
        ) {
            return;
        }


        if (wheelLocked) {
            return;
        }


        if (
            Math.abs(
                event.deltaY
            ) < 20
        ) {
            return;
        }


        wheelLocked = true;


        if (
            event.deltaY > 0
        ) {

            nextProduct();

        } else {

            previousProduct();
        }


        setTimeout(
            () => {

                wheelLocked = false;

            },
            450
        );
    },
    {
        passive: true
    }
);


// =====================================
// KEYBOARD
// =====================================

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "ArrowDown"
        ) {

            nextProduct();
        }


        if (
            event.key ===
            "ArrowUp"
        ) {

            previousProduct();
        }
    }
);


// =====================================
// SHARE
// =====================================

async function shareProduct(event) {

    if (event) {
        event.stopPropagation();
    }


    if (!products.length) {
        return;
    }


    const item =
        products[currentIndex];


    const url =
        item.link ||
        window.location.href;


    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    item.name ||
                    item.title ||
                    "Товар",

                url: url

            });

        } catch (error) {

            console.log(
                "Share cancelled"
            );
        }


    } else {

        try {

            await navigator.clipboard
                .writeText(url);

            showToast(
                "🔗 Ссылка скопирована"
            );

        } catch {

            showToast(
                "🔗 " + url
            );
        }
    }
}


// =====================================
// COMMENTS
// =====================================

function openComments() {

    const overlay =
        document.getElementById(
            "commentsOverlay"
        );


    const list =
        document.getElementById(
            "commentsList"
        );


    if (!overlay || !list) {
        return;
    }


    const item =
        products[currentIndex];


    list.innerHTML = "";


    /*
     * Пока реальные отзывы
     * не подключены,
     * показываем демо.
     */

    const comments = [

        {
            user: "Алекс",
            text: "Выглядит очень круто 👍",
            date: "2 дня назад"
        },

        {
            user: "Мария",
            text: "Кто-нибудь уже заказывал?",
            date: "5 дней назад"
        },

        {
            user: "Илья",
            text: "Цена интересная",
            date: "1 неделю назад"
        },

        {
            user: "Катя",
            text: "Размер подошёл идеально",
            date: "1 неделю назад"
        }

    ];


    comments.forEach(
        comment => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "comment";


            element.innerHTML = `

                <div class="comment-user">
                    ${escapeHtml(
                        comment.user
                    )}
                </div>

                <div class="comment-text">
                    ${escapeHtml(
                        comment.text
                    )}
                </div>

                <div class="comment-date">
                    ${escapeHtml(
                        comment.date
                    )}
                </div>
            `;


            list.appendChild(
                element
            );
        }
    );


    overlay.classList.add(
        "show"
    );
}


// =====================================
// CLOSE COMMENTS
// =====================================

function closeComments(event) {

    if (
        event &&
        event.target !== event.currentTarget
    ) {
        return;
    }


    const overlay =
        document.getElementById(
            "commentsOverlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "show"
        );
    }
}


// =====================================
// FAVORITES SCREEN
// =====================================

function switchTab(button, tab) {

    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(
            item => {

                item.classList.remove(
                    "active"
                );
            }
        );


    if (button) {

        button.classList.add(
            "active"
        );
    }


    currentTab = tab;


    const feed =
        document.getElementById(
            "feed"
        );


    const favoritesScreen =
        document.getElementById(
            "favoritesScreen"
        );


    if (
        tab === "favorites"
    ) {

        feed.style.display =
            "none";


        favoritesScreen.classList.add(
            "show"
        );


        renderFavorites();

        return;
    }


    if (
        tab === "feed"
    ) {

        favoritesScreen.classList.remove(
            "show"
        );


        feed.style.display =
            "block";


        products =
            allProducts;


        currentIndex = 0;


        render();
    }
}


// =====================================
// FAVORITES GRID
// =====================================

function renderFavorites() {

    const grid =
        document.getElementById(
            "favoritesGrid"
        );


    const count =
        document.getElementById(
            "favoritesCount"
        );


    if (!grid) {
        return;
    }


    count.textContent =
        favorites.length
            ? `${favorites.length} сохранённых товаров`
            : "Здесь появятся понравившиеся товары";


    if (!favorites.length) {

        grid.innerHTML = `

            <div
                class="empty-state"
                style="
                    position:relative;
                    grid-column:1/-1;
                    min-height:50vh;
                "
            >

                <div class="empty-icon">
                    ❤️
                </div>

                <h2>
                    Пока пусто
                </h2>

                <p>
                    Лайкните понравившийся товар
                </p>

            </div>
        `;

        return;
    }


    grid.innerHTML = "";


    favorites.forEach(
        (item, index) => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "favorite-card";


            const image =
                item.image ||
                (
                    item.images &&
                    item.images.length
                        ? item.images[0]
                        : ""
                );


            card.innerHTML = `

                ${
                    image
                        ? `
                            <img
                                src="${escapeHtml(image)}"
                                draggable="false"
                            >
                        `
                        :
                        `
                            <div
                                style="
                                    aspect-ratio:.78;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    font-size:45px;
                                "
                            >
                                🛍️
                            </div>
                        `
                }

                <div
                    class="favorite-card-info"
                >

                    <div
                        class="favorite-card-name"
                    >
                        ${escapeHtml(
                            item.name ||
                            item.title ||
                            "Товар"
                        )}
                    </div>

                    <div
                        class="favorite-card-price"
                    >
                        ${item.price || 0} $
                    </div>

                </div>
            `;


            card.onclick =
                () => openFavorite(index);


            grid.appendChild(card);
        }
    );
}


// =====================================
// OPEN FAVORITE
// =====================================

function openFavorite(index) {

    if (
        !favorites.length
    ) {
        return;
    }


    products =
        favorites;


    currentIndex =
        index;


    currentTab =
        "feed";


    document
        .getElementById(
            "favoritesScreen"
        )
        .classList.remove(
            "show"
        );


    document
        .getElementById(
            "feed"
        )
        .style.display =
        "block";


    document
        .querySelectorAll(
            ".nav-item"
        )
        .forEach(
            item =>
                item.classList.remove(
                    "active"
                )
        );


    document
        .querySelector(
            ".nav-item"
        )
        .classList.add(
            "active"
        );


    render();
}


// =====================================
// PROFILE
// =====================================

function showProfile() {

    showToast(
        "👤 Профиль скоро появится"
    );
}


// =====================================
// EMPTY
// =====================================

function showEmpty(
    icon,
    title,
    text
) {

    const card =
        document.getElementById(
            "card"
        );


    if (!card) {
        return;
    }


    card.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">
                ${icon}
            </div>

            <h2>
                ${escapeHtml(title)}
            </h2>

            <p>
                ${escapeHtml(text)}
            </p>

        </div>
    `;
}


// =====================================
// TOAST
// =====================================

function showToast(message) {

    let toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "toast";


        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        window.toastTimer
    );


    window.toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            1800
        );
}


// =====================================
// ESCAPE
// =====================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


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


// =====================================
// START
// =====================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "StyleFlow TikTok UI started"
        );


        loadProducts();

    }
);
