/* =========================================================
   STYLEFLOW
   Frontend for marketplace aggregation

   IMPORTANT:
   Product objects are normalized in one place.
   This allows us to connect WB / Ozon / AliExpress /
   Kufar / other marketplaces later without rebuilding UI.
========================================================= */

let allProducts = [];
let products = [];

let currentIndex = 0;
let currentProduct = null;

let favorites = loadJSON("styleflow_favorites", []);
let viewedProducts = loadJSON("styleflow_viewed", []);
let openedProducts = loadJSON("styleflow_opened", []);

let currentTab = "feed";

let touchStartY = 0;
let touchStartX = 0;
let isDragging = false;

let lastTapTime = 0;

let searchTimer = null;


/* =========================================================
   TELEGRAM
========================================================= */

if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

    try {
        Telegram.WebApp.setHeaderColor("#09090d");
        Telegram.WebApp.setBackgroundColor("#09090d");
    } catch (e) {}
}


/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () {

    setupSearch();

    setupSwipe();

    loadFeed();

    updateProfile();

});


/* =========================================================
   LOAD FEED
========================================================= */

async function loadFeed() {

    try {

        const response = await fetch("/api/feed", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Feed request failed");
        }

        const data = await response.json();

        const rawProducts =
            Array.isArray(data)
                ? data
                : Array.isArray(data.products)
                    ? data.products
                    : Array.isArray(data.items)
                        ? data.items
                        : [];

        allProducts = rawProducts.map(normalizeProduct);

        // Персональная лента: исключаем товары, которые
        // пользователь уже просмотрел на этом устройстве.
        products = allProducts.filter(product => {
            return !viewedProducts.some(viewedId => {
                return String(viewedId) === String(product.id);
            });
        });

        localStorage.setItem(
            "styleflow_main_feed",
            JSON.stringify(allProducts)
        );

        currentIndex = 0;

        if (products.length > 0) {
            showProduct();
        } else {
            showEmptyFeed();
        }

    } catch (error) {

        console.error("Feed error:", error);

        const cached =
            loadJSON("styleflow_main_feed", []);

        if (cached.length > 0) {

            allProducts = cached.map(normalizeProduct);

            // Кеш тоже фильтруем по истории просмотра.
            products = allProducts.filter(product => {
                return !viewedProducts.some(viewedId => {
                    return String(viewedId) === String(product.id);
                });
            });

            currentIndex = 0;

            showProduct();

            showToast("Показана последняя сохранённая лента");

        } else {

            showEmptyFeed();

        }

    }

}


/* =========================================================
   PRODUCT NORMALIZATION
   THE MOST IMPORTANT PART FOR FUTURE MARKETPLACES
========================================================= */

function normalizeProduct(item, index = 0) {

    const source =
        item.source ||
        item.marketplace ||
        item.platform ||
        detectSource(item.url || item.link || "");

    const title =
        item.title ||
        item.name ||
        item.product_name ||
        "Товар";

    const image =
        item.image ||
        item.image_url ||
        item.thumbnail ||
        (
            Array.isArray(item.images)
                ? item.images[0]
                : ""
        ) ||
        "https://via.placeholder.com/600x800?text=StyleFlow";

    const url =
        item.url ||
        item.link ||
        item.product_url ||
        "#";

    const price =
        parsePrice(
            item.price ??
            item.current_price ??
            item.sale_price
        );

    const oldPrice =
        parsePrice(
            item.old_price ??
            item.oldPrice ??
            item.original_price
        );

    const rating =
        item.rating ??
        item.stars ??
        "";

    const brand =
        item.brand ||
        item.vendor ||
        "";

    const category =
        item.category ||
        item.type ||
        "Одежда";

    const id =
        String(
            item.id ??
            item.product_id ??
            item.external_id ??
            `${source}_${index}_${title}`
        );

    return {

        id,

        source: normalizeSource(source),

        external_id:
            String(
                item.external_id ??
                item.product_id ??
                item.id ??
                ""
            ),

        title,
        brand,
        category,

        price,
        oldPrice,

        currency:
            item.currency ||
            detectCurrency(item),

        rating,

        image,

        images:
            Array.isArray(item.images)
                ? item.images
                : [image],

        url,

        // Keep the original object.
        // This is useful when we connect real marketplaces.
        raw: item

    };

}


/* =========================================================
   SOURCE HELPERS
========================================================= */

function detectSource(url) {

    const value = String(url).toLowerCase();

    if (value.includes("wildberries")) {
        return "wildberries";
    }

    if (value.includes("ozon")) {
        return "ozon";
    }

    if (value.includes("aliexpress")) {
        return "aliexpress";
    }

    if (value.includes("kufar")) {
        return "kufar";
    }

    return "marketplace";
}


function normalizeSource(source) {

    const value =
        String(source || "")
            .toLowerCase()
            .trim();

    if (
        value.includes("wild") ||
        value === "wb"
    ) {
        return "wildberries";
    }

    if (value.includes("ozon")) {
        return "ozon";
    }

    if (
        value.includes("ali") ||
        value.includes("aliexpress")
    ) {
        return "aliexpress";
    }

    if (value.includes("kufar")) {
        return "kufar";
    }

    return value || "marketplace";
}


function sourceLabel(source) {

    const labels = {
        wildberries: "🟣 Wildberries",
        ozon: "🔵 Ozon",
        aliexpress: "🟠 AliExpress",
        kufar: "🟢 Kufar",
        marketplace: "🛍 Marketplace"
    };

    return labels[source] || "🛍 " + capitalize(source);
}


/* =========================================================
   PRICE
========================================================= */

function parsePrice(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (typeof value === "number") {
        return value;
    }

    const cleaned =
        String(value)
            .replace(/[^\d.,-]/g, "")
            .replace(",", ".");

    const number = Number(cleaned);

    return Number.isFinite(number)
        ? number
        : null;
}


function detectCurrency(item) {

    const raw =
        String(
            item.currency ||
            item.price ||
            ""
        ).toLowerCase();

    if (
        raw.includes("byn") ||
        raw.includes("бел")
    ) {
        return "BYN";
    }

    if (
        raw.includes("₽") ||
        raw.includes("rub") ||
        raw.includes("руб")
    ) {
        return "RUB";
    }

    if (
        raw.includes("$") ||
        raw.includes("usd")
    ) {
        return "USD";
    }

    return "BYN";
}


function formatPrice(product) {

    if (product.price === null) {
        return "Цена уточняется";
    }

    const currency =
        product.currency || "BYN";

    const symbols = {
        BYN: "BYN",
        RUB: "₽",
        USD: "$",
        EUR: "€"
    };

    const symbol =
        symbols[currency] || currency;

    return (
        Number(product.price)
            .toLocaleString("ru-RU", {
                maximumFractionDigits: 2
            })
        + " "
        + symbol
    );
}


/* =========================================================
   FEED DISPLAY
========================================================= */

function showProduct() {

    if (!products.length) {
        showEmptyFeed();
        return;
    }

    if (currentIndex < 0) {
        currentIndex = products.length - 1;
    }

    if (currentIndex >= products.length) {
        currentIndex = 0;
    }

    currentProduct =
        products[currentIndex];

    const image =
        document.getElementById("productImage");

    const title =
        document.getElementById("productTitle");

    const brand =
        document.getElementById("productBrand");

    const source =
        document.getElementById("productSource");

    const price =
        document.getElementById("productPrice");

    const oldPrice =
        document.getElementById("productOldPrice");

    const rating =
        document.getElementById("productRating");

    const category =
        document.getElementById("productCategory");

    image.src =
        currentProduct.image;

    image.alt =
        currentProduct.title;

    title.textContent =
        currentProduct.title;

    brand.textContent =
        currentProduct.brand ||
        "StyleFlow";

    source.textContent =
        sourceLabel(currentProduct.source);

    price.textContent =
        formatPrice(currentProduct);

    if (currentProduct.oldPrice) {

        oldPrice.textContent =
            formatPrice({
                price: currentProduct.oldPrice,
                currency: currentProduct.currency
            });

    } else {

        oldPrice.textContent = "";

    }

    if (currentProduct.rating !== "") {

        rating.textContent =
            "★ " + currentProduct.rating;

    } else {

        rating.textContent =
            "★ —";

    }

    category.textContent =
        currentProduct.category ||
        "Одежда";

    updateLikeButton();

    registerView(currentProduct);

    resetCardPosition();

}


/* =========================================================
   EMPTY FEED
========================================================= */

function showEmptyFeed() {

    document.getElementById("productCard").style.display =
        "none";

    document.getElementById("feedEmpty").style.display =
        "flex";

}


/* =========================================================
   NAVIGATION
========================================================= */

function switchTab(tab) {

    currentTab = tab;

    const screens = {
        feed: "feedScreen",
        favorites: "favoritesScreen",
        search: "searchScreen",
        profile: "profileScreen"
    };

    Object.values(screens).forEach(id => {

        document
            .getElementById(id)
            .classList.remove("active");

    });

    document
        .getElementById(screens[tab])
        .classList.add("active");


    const navs = {
        feed: "navFeed",
        favorites: "navFavorites",
        search: "navSearch",
        profile: "navProfile"
    };

    Object.values(navs).forEach(id => {

        document
            .getElementById(id)
            .classList.remove("active");

    });

    document
        .getElementById(navs[tab])
        .classList.add("active");


    if (tab === "favorites") {
        renderFavorites();
    }

    if (tab === "profile") {
        updateProfile();
    }

    if (tab === "search") {

        setTimeout(() => {

            document
                .getElementById("searchInput")
                .focus();

        }, 100);

    }

}


/* =========================================================
   FAVORITES
========================================================= */

function isFavorite(productId) {

    return favorites.some(
        item => String(item.id) === String(productId)
    );

}


function toggleLike() {

    if (!currentProduct) {
        return;
    }

    const index =
        favorites.findIndex(
            item =>
                String(item.id) ===
                String(currentProduct.id)
        );

    if (index >= 0) {

        favorites.splice(index, 1);

        showToast("Удалено из избранного");

    } else {

        favorites.unshift(currentProduct);

        showToast("❤️ Добавлено в избранное");

        showHeart();

    }

    saveJSON(
        "styleflow_favorites",
        favorites
    );

    updateLikeButton();

    updateProfile();

}


function updateLikeButton() {

    const button =
        document.getElementById("likeButton");

    if (!currentProduct) {
        return;
    }

    if (isFavorite(currentProduct.id)) {

        button.classList.add("liked");

        button.querySelector(".action-icon")
            .textContent = "❤️";

    } else {

        button.classList.remove("liked");

        button.querySelector(".action-icon")
            .textContent = "♥";

    }

}


function renderFavorites() {

    const grid =
        document.getElementById("favoritesGrid");

    const empty =
        document.getElementById("favoritesEmpty");

    grid.innerHTML = "";

    if (!favorites.length) {

        empty.style.display = "flex";

        return;

    }

    empty.style.display = "none";


    favorites.forEach(product => {

        const card =
            document.createElement("div");

        card.className =
            "favorite-card";

        card.innerHTML = `

            <img
                src="${escapeAttribute(product.image)}"
                alt="${escapeAttribute(product.title)}"
            >

            <div class="favorite-info">

                <div class="favorite-title">
                    ${escapeHTML(product.title)}
                </div>

                <div class="favorite-price">
                    ${escapeHTML(formatPrice(product))}
                </div>

            </div>

        `;

        card.onclick = () => {

            openProductFromObject(product);

        };

        grid.appendChild(card);

    });

}


/* =========================================================
   OPEN PRODUCT
========================================================= */

function openCurrentProduct() {

    if (!currentProduct) {
        return;
    }

    if (
        !currentProduct.url ||
        currentProduct.url === "#"
    ) {

        showToast(
            "Ссылка на товар пока не подключена"
        );

        return;

    }

    registerOpen(currentProduct);

    try {

        if (
            window.Telegram &&
            Telegram.WebApp &&
            Telegram.WebApp.openLink
        ) {

            Telegram.WebApp.openLink(
                currentProduct.url
            );

        } else {

            window.open(
                currentProduct.url,
                "_blank"
            );

        }

    } catch (error) {

        window.open(
            currentProduct.url,
            "_blank"
        );

    }

}


function openProductFromObject(product) {

    const index =
        products.findIndex(
            item =>
                String(item.id) ===
                String(product.id)
        );

    if (index >= 0) {

        currentIndex = index;

        showProduct();

        switchTab("feed");

        return;

    }

    currentProduct = product;

    renderSingleProductObject(product);

    switchTab("feed");

}


function renderSingleProductObject(product) {

    document.getElementById("productImage").src =
        product.image;

    document.getElementById("productTitle").textContent =
        product.title;

    document.getElementById("productBrand").textContent =
        product.brand || "StyleFlow";

    document.getElementById("productSource").textContent =
        sourceLabel(product.source);

    document.getElementById("productPrice").textContent =
        formatPrice(product);

    document.getElementById("productOldPrice").textContent =
        product.oldPrice
            ? formatPrice({
                price: product.oldPrice,
                currency: product.currency
            })
            : "";

    document.getElementById("productRating").textContent =
        product.rating
            ? "★ " + product.rating
            : "★ —";

    document.getElementById("productCategory").textContent =
        product.category || "Одежда";

    updateLikeButton();

}


/* =========================================================
   SHARE
========================================================= */

async function shareCurrentProduct() {

    if (!currentProduct) {
        return;
    }

    const text =
        `${currentProduct.title} — ${formatPrice(currentProduct)}`;

    try {

        if (navigator.share) {

            await navigator.share({

                title:
                    currentProduct.title,

                text,

                url:
                    currentProduct.url

            });

        } else {

            await navigator.clipboard.writeText(
                currentProduct.url
            );

            showToast(
                "🔗 Ссылка скопирована"
            );

        }

    } catch (error) {

        // User cancelled share.
    }

}


/* =========================================================
   COMMENTS
========================================================= */

function openComments() {

    const overlay =
        document.getElementById(
            "commentsOverlay"
        );

    const list =
        document.getElementById(
            "commentsList"
        );

    const comments = [

        {
            user: "Алекс",
            text: "Выглядит очень круто 👍"
        },

        {
            user: "Мария",
            text: "Кто-нибудь уже заказывал?"
        },

        {
            user: "Илья",
            text: "Цена интересная"
        },

        {
            user: "Катя",
            text: "Размер подошёл идеально"
        }

    ];

    list.innerHTML =
        comments.map(comment => `

            <div class="comment">

                <div class="comment-user">
                    ${escapeHTML(comment.user)}
                </div>

                <div class="comment-text">
                    ${escapeHTML(comment.text)}
                </div>

            </div>

        `).join("");

    overlay.classList.add("show");

}


function closeComments(event) {

    if (
        !event ||
        event.target.id ===
        "commentsOverlay"
    ) {

        document
            .getElementById("commentsOverlay")
            .classList.remove("show");

    }

}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );

    input.addEventListener(
        "input",
        () => {

            const value =
                input.value.trim();

            document
                .getElementById("searchClear")
                .style.display =
                    value
                        ? "flex"
                        : "none";

            clearTimeout(searchTimer);

            searchTimer =
                setTimeout(
                    () => performSearch(value),
                    150
                );

        }
    );

    input.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                performSearch(
                    input.value.trim()
                );

            }

        }
    );

}


function quickSearch(query) {

    switchTab("search");

    const input =
        document.getElementById(
            "searchInput"
        );

    input.value = query;

    document
        .getElementById("searchClear")
        .style.display = "flex";

    performSearch(query);

}


function clearSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );

    input.value = "";

    document
        .getElementById("searchClear")
        .style.display = "none";

    document
        .getElementById("searchResults")
        .classList.remove("active");

    document
        .getElementById("searchHome")
        .style.display = "block";

    input.focus();

}


function performSearch(query) {

    const home =
        document.getElementById(
            "searchHome"
        );

    const results =
        document.getElementById(
            "searchResults"
        );

    const resultList =
        document.getElementById(
            "resultList"
        );

    const resultCount =
        document.getElementById(
            "resultCount"
        );


    if (!query) {

        home.style.display = "block";

        results.classList.remove("active");

        return;

    }


    home.style.display = "none";

    results.classList.add("active");


    const normalizedQuery =
        query
            .toLowerCase()
            .trim();


    const tokens =
        normalizedQuery
            .split(/\s+/)
            .filter(Boolean);


    const filtered =
        allProducts.filter(product => {

            const searchable = [

                product.title,

                product.brand,

                product.category,

                product.source,

                sourceLabel(product.source)

            ]
                .join(" ")
                .toLowerCase();


            return tokens.every(
                token =>
                    searchable.includes(token)
            );

        });


    resultCount.textContent =
        filtered.length === 1
            ? "Найден 1 товар"
            : `Найдено товаров: ${filtered.length}`;


    resultList.innerHTML = "";


    if (!filtered.length) {

        resultList.innerHTML = `

            <div class="empty" style="position:relative; min-height:300px;">

                <div class="empty-inner">

                    <div class="empty-icon">
                        🔎
                    </div>

                    <h2>
                        Ничего не нашли
                    </h2>

                    <p>
                        Попробуй другое название,
                        бренд или категорию.
                    </p>

                </div>

            </div>

        `;

        return;

    }


    filtered.forEach(product => {

        const card =
            document.createElement("div");

        card.className =
            "result-card";

        card.innerHTML = `

            <img
                class="result-image"
                src="${escapeAttribute(product.image)}"
                alt="${escapeAttribute(product.title)}"
            >

            <div class="result-info">

                <div class="result-brand">
                    ${escapeHTML(
                        product.brand ||
                        sourceLabel(product.source)
                    )}
                </div>

                <div class="result-title">
                    ${escapeHTML(product.title)}
                </div>

                <div class="result-price">
                    ${escapeHTML(
                        formatPrice(product)
                    )}
                </div>

            </div>

        `;

        card.onclick = () => {

            openProductFromObject(product);

        };

        resultList.appendChild(card);

    });

}


/* =========================================================
   PROFILE
========================================================= */

function updateProfile() {

    const likedCount =
        document.getElementById(
            "likedCount"
        );

    const viewedCount =
        document.getElementById(
            "viewedCount"
        );

    const openedCount =
        document.getElementById(
            "openedCount"
        );

    const collectionCount =
        document.getElementById(
            "collectionCount"
        );


    likedCount.textContent =
        favorites.length;

    viewedCount.textContent =
        viewedProducts.length;

    openedCount.textContent =
        openedProducts.length;

    collectionCount.textContent =
        `${favorites.length} ${
            getRussianPlural(
                favorites.length,
                "товар",
                "товара",
                "товаров"
            )
        }`;


    renderRecentProducts();

}


function renderRecentProducts() {

    const grid =
        document.getElementById(
            "recentGrid"
        );

    grid.innerHTML = "";


    const recentIds =
        [...viewedProducts]
            .reverse()
            .slice(0, 6);


    const recent =
        recentIds
            .map(id =>
                allProducts.find(
                    product =>
                        String(product.id) ===
                        String(id)
                )
            )
            .filter(Boolean);


    recent.forEach(product => {

        const card =
            document.createElement("div");

        card.className =
            "recent-card";

        card.innerHTML = `

            <img
                src="${escapeAttribute(product.image)}"
                alt="${escapeAttribute(product.title)}"
            >

            <div class="recent-price">
                ${escapeHTML(formatPrice(product))}
            </div>

        `;

        card.onclick = () => {

            openProductFromObject(product);

        };

        grid.appendChild(card);

    });


    if (!recent.length) {

        grid.innerHTML = `

            <div style="
                grid-column:1/-1;
                padding:25px 5px;
                color:rgba(255,255,255,.4);
                font-size:13px;
            ">
                Начни листать ленту —
                здесь появятся твои находки.
            </div>

        `;

    }

}


function openCollection(type) {

    if (type === "favorites") {

        switchTab("favorites");

    }

}


/* =========================================================
   VIEW / OPEN TRACKING
========================================================= */

function registerView(product) {

    if (!product) {
        return;
    }

    const id =
        String(product.id);

    if (
        !viewedProducts
            .map(String)
            .includes(id)
    ) {

        viewedProducts.push(id);

        if (viewedProducts.length > 500) {
            viewedProducts.shift();
        }

        saveJSON(
            "styleflow_viewed",
            viewedProducts
        );

    }

}


function registerOpen(product) {

    if (!product) {
        return;
    }

    const id =
        String(product.id);

    openedProducts.push(id);

    if (openedProducts.length > 500) {
        openedProducts.shift();
    }

    saveJSON(
        "styleflow_opened",
        openedProducts
    );

    updateProfile();

}


/* =========================================================
   SWIPE
========================================================= */

function setupSwipe() {

    const card =
        document.getElementById(
            "productCard"
        );


    card.addEventListener(
        "touchstart",
        event => {

            if (!currentProduct) {
                return;
            }

            touchStartY =
                event.touches[0].clientY;

            touchStartX =
                event.touches[0].clientX;

            isDragging = true;

            card.classList.add("dragging");

        },
        { passive: true }
    );


    card.addEventListener(
        "touchmove",
        event => {

            if (!isDragging) {
                return;
            }

            const y =
                event.touches[0].clientY;

            const x =
                event.touches[0].clientX;

            const deltaY =
                y - touchStartY;

            const deltaX =
                x - touchStartX;


            if (
                Math.abs(deltaY) >
                Math.abs(deltaX)
            ) {

                event.preventDefault();

                card.style.transform =
                    `translateY(${deltaY}px)
                     rotate(${deltaY * -.025}deg)`;

            }

        },
        { passive: false }
    );


    card.addEventListener(
        "touchend",
        event => {

            if (!isDragging) {
                return;
            }

            isDragging = false;

            card.classList.remove("dragging");


            const touch =
                event.changedTouches[0];

            const deltaY =
                touch.clientY -
                touchStartY;


            card.style.transform = "";


            if (Math.abs(deltaY) > 80) {

                if (deltaY < 0) {
                    nextProduct();
                } else {
                    previousProduct();
                }

                return;

            }


            // Double tap
            const now =
                Date.now();

            if (
                now - lastTapTime <
                350
            ) {

                toggleLike();

            }

            lastTapTime = now;

        },
        { passive: true }
    );


    // Mouse wheel
    let wheelLocked = false;

    card.addEventListener(
        "wheel",
        event => {

            if (wheelLocked) {
                return;
            }

            wheelLocked = true;

            if (event.deltaY > 0) {
                nextProduct();
            } else {
                previousProduct();
            }

            setTimeout(() => {
                wheelLocked = false;
            }, 300);

        },
        { passive: true }
    );


    // Keyboard
    document.addEventListener(
        "keydown",
        event => {

            if (currentTab !== "feed") {
                return;
            }

            if (
                event.key === "ArrowDown" ||
                event.key === "ArrowRight"
            ) {
                nextProduct();
            }

            if (
                event.key === "ArrowUp" ||
                event.key === "ArrowLeft"
            ) {
                previousProduct();
            }

        }
    );

}


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

    animateCardChange(
        "next"
    );

}


function previousProduct() {

    if (!products.length) {
        return;
    }

    currentIndex--;

    if (currentIndex < 0) {
        currentIndex =
            products.length - 1;
    }

    animateCardChange(
        "previous"
    );

}


function animateCardChange(direction) {

    const card =
        document.getElementById(
            "productCard"
        );

    card.style.opacity = "0";

    card.style.transform =
        direction === "next"
            ? "translateY(-20px)"
            : "translateY(20px)";


    setTimeout(() => {

        showProduct();

        requestAnimationFrame(() => {

            card.style.opacity = "1";
            card.style.transform = "";

        });

    }, 100);

}


function resetCardPosition() {

    const card =
        document.getElementById(
            "productCard"
        );

    card.style.opacity = "1";
    card.style.transform = "";

}


/* =========================================================
   HEART
========================================================= */

function showHeart() {

    const heart =
        document.getElementById(
            "bigHeart"
        );

    heart.classList.remove("show");

    void heart.offsetWidth;

    heart.classList.add("show");

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 1800);

}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadJSON(key, fallback) {

    try {

        const value =
            localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        const parsed =
            JSON.parse(value);

        return parsed ?? fallback;

    } catch (error) {

        return fallback;

    }

}


function saveJSON(key, value) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.error(
            "localStorage error:",
            error
        );

    }

}


/* =========================================================
   SECURITY / HTML HELPERS
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


/* =========================================================
   UTILS
========================================================= */

function capitalize(value) {

    const text =
        String(value || "");

    if (!text) {
        return "";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );

}


function getRussianPlural(
    number,
    one,
    few,
    many
) {

    const n =
        Math.abs(number) % 100;

    const n1 =
        n % 10;

    if (
        n > 10 &&
        n < 20
    ) {
        return many;
    }

    if (n1 === 1) {
        return one;
    }

    if (
        n1 >= 2 &&
        n1 <= 4
    ) {
        return few;
    }

    return many;

}
