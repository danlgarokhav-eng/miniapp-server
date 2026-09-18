/* =========================================================
STYLEFLOW
Personalized marketplace feed

ЭТАП 1:
- не показываем уже просмотренные товары
- собираем интересы пользователя
- ранжируем товары под пользователя
- учитываем:
    * категории
    * бренды
    * маркетплейсы
    * цены
    * лайки
    * открытия товаров
- сохраняем историю в localStorage

Product objects are normalized in one place.
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
START
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
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

        console.log("[StyleFlow] Feed response:", data);

        const rawProducts =
            Array.isArray(data)
                ? data
                : Array.isArray(data.products)
                    ? data.products
                    : Array.isArray(data.items)
                        ? data.items
                        : [];

        console.log(
            "[StyleFlow] Получено товаров:",
            rawProducts.length
        );

        allProducts =
            rawProducts.map(normalizeProduct);

        console.log(
            "[StyleFlow] Нормализовано товаров:",
            allProducts.length
        );

        if (allProducts.length > 0) {
            console.log(
                "[StyleFlow] Первый товар:",
                allProducts[0]
            );
        }

        localStorage.setItem(
            "styleflow_main_feed",
            JSON.stringify(allProducts)
        );

        buildPersonalizedFeed();

        currentIndex = 0;

        if (products.length > 0) {
            showProduct();
        } else {
            showEmptyFeed();
        }

    } catch (error) {
        console.error(
            "[StyleFlow] Feed error:",
            error
        );

        const cached =
            loadJSON(
                "styleflow_main_feed",
                []
            );

        if (cached.length > 0) {
            allProducts =
                cached.map(normalizeProduct);

            buildPersonalizedFeed();

            currentIndex = 0;

            if (products.length > 0) {
                showProduct();
            } else {
                showEmptyFeed();
            }

            showToast(
                "Показана последняя сохранённая лента"
            );

        } else {
            showEmptyFeed();
        }
    }
}


/* =========================================================
NORMALIZE PRODUCT
========================================================= */

function normalizeProduct(item, index = 0) {

    const source =
        item.source ||
        item.marketplace ||
        item.platform ||
        detectSource(
            item.url ||
            item.link ||
            ""
        );

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

        source:
            normalizeSource(source),

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

        raw: item
    };
}


/* =========================================================
SOURCE
========================================================= */

function detectSource(url) {

    const value =
        String(url)
            .toLowerCase();

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

    return (
        labels[source] ||
        "🛍 " + capitalize(source)
    );
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

    const number =
        Number(cleaned);

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
        symbols[currency] ||
        currency;

    return (
        Number(product.price)
            .toLocaleString(
                "ru-RU",
                {
                    maximumFractionDigits: 2
                }
            )
        + " "
        + symbol
    );
}


/* =========================================================
PERSONALIZED FEED
========================================================= */

function buildPersonalizedFeed() {

    if (!allProducts.length) {
        products = [];
        return;
    }


    const viewedSet =
        new Set(
            viewedProducts.map(String)
        );


    const unviewed =
        allProducts.filter(
            product =>
                !viewedSet.has(
                    String(product.id)
                )
        );


    console.log(
        "[StyleFlow] Всего товаров:",
        allProducts.length
    );

    console.log(
        "[StyleFlow] Просмотрено:",
        viewedSet.size
    );

    console.log(
        "[StyleFlow] Непросмотренных:",
        unviewed.length
    );


    /*
    Если остались непросмотренные товары —
    используем только их.

    Если пользователь просмотрел абсолютно всё —
    начинаем новый круг.
    */

    let candidates;


    if (unviewed.length > 0) {

        candidates =
            unviewed;

    } else {

        console.log(
            "[StyleFlow] Все товары просмотрены. Начинаем новый круг."
        );


        candidates =
            [...allProducts];


        /*
        Начинаем новый круг.
        */

        viewedProducts = [];


        saveJSON(
            "styleflow_viewed",
            viewedProducts
        );
    }


    /*
    Получаем профиль интересов пользователя.
    */

    const profile =
        buildUserProfile();


    /*
    Если пользователь новый —
    просто перемешиваем товары.

    Если уже есть история —
    сортируем по персональному score.
    */

    const hasProfile =
        profile.totalSignals > 0;


    if (!hasProfile) {

        products =
            shuffleArray(
                candidates
            );

        console.log(
            "[StyleFlow] Новый пользователь — случайная лента"
        );

        return;
    }


    products =
        candidates
            .map(product => ({
                product,

                score:
                    calculateRecommendationScore(
                        product,
                        profile
                    )
            }))
            .sort(
                (a, b) =>
                    b.score - a.score
            )
            .map(
                item =>
                    item.product
            );


    console.log(
        "[StyleFlow] Персональная лента построена"
    );

    console.log(
        "[StyleFlow] Профиль:",
        profile
    );
}


/* =========================================================
USER PROFILE
========================================================= */

function buildUserProfile() {

    const profile = {

        categories: {},

        brands: {},

        sources: {},

        prices: [],

        totalSignals: 0
    };


    /*
    Просмотренные товары дают слабый сигнал.
    */

    viewedProducts.forEach(
        id => {

            const product =
                findProductById(id);

            if (!product) return;

            addProfileSignal(
                profile,
                product,
                1
            );
        }
    );


    /*
    Открытие карточки товара —
    более сильный сигнал.
    */

    openedProducts.forEach(
        id => {

            const product =
                findProductById(id);

            if (!product) return;

            addProfileSignal(
                profile,
                product,
                3
            );
        }
    );


    /*
    Лайк —
    самый сильный сигнал.
    */

    favorites.forEach(
        product => {

            const normalized =
                normalizeProduct(
                    product
                );

            addProfileSignal(
                profile,
                normalized,
                6
            );
        }
    );


    return profile;
}


function addProfileSignal(
    profile,
    product,
    weight
) {

    if (!product) return;


    /*
    CATEGORY
    */

    const category =
        normalizeText(
            product.category
        );

    if (category) {

        profile.categories[category] =
            (
                profile.categories[category] ||
                0
            ) + weight;
    }


    /*
    BRAND
    */

    const brand =
        normalizeText(
            product.brand
        );

    if (brand) {

        profile.brands[brand] =
            (
                profile.brands[brand] ||
                0
            ) + weight;
    }


    /*
    MARKETPLACE
    */

    const source =
        normalizeText(
            product.source
        );

    if (source) {

        profile.sources[source] =
            (
                profile.sources[source] ||
                0
            ) + weight;
    }


    /*
    PRICE
    */

    if (
        product.price !== null &&
        Number.isFinite(
            Number(product.price)
        )
    ) {

        profile.prices.push({
            price:
                Number(product.price),

            weight
        });
    }


    profile.totalSignals += weight;
}


/* =========================================================
RECOMMENDATION SCORE
========================================================= */

function calculateRecommendationScore(
    product,
    profile
) {

    let score = 0;


    /*
    CATEGORY
    */

    const category =
        normalizeText(
            product.category
        );

    if (
        category &&
        profile.categories[category]
    ) {

        score +=
            profile.categories[category] *
            5;
    }


    /*
    BRAND
    */

    const brand =
        normalizeText(
            product.brand
        );

    if (
        brand &&
        profile.brands[brand]
    ) {

        score +=
            profile.brands[brand] *
            7;
    }


    /*
    MARKETPLACE
    */

    const source =
        normalizeText(
            product.source
        );

    if (
        source &&
        profile.sources[source]
    ) {

        score +=
            profile.sources[source] *
            2;
    }


    /*
    PRICE SIMILARITY
    */

    if (
        product.price !== null &&
        profile.prices.length > 0
    ) {

        const averagePrice =
            getWeightedAveragePrice(
                profile.prices
            );


        if (
            averagePrice > 0
        ) {

            const difference =
                Math.abs(
                    Number(product.price) -
                    averagePrice
                );


            const percentage =
                difference /
                averagePrice;


            /*
            Чем ближе цена к привычному
            диапазону пользователя,
            тем выше score.
            */

            if (percentage <= 0.10) {

                score += 12;

            } else if (percentage <= 0.25) {

                score += 7;

            } else if (percentage <= 0.50) {

                score += 3;
            }
        }
    }


    /*
    Небольшой случайный фактор.

    Он нужен, чтобы товары с одинаковым
    score не шли всегда в одном порядке.
    */

    score +=
        Math.random() * 4;


    return score;
}


/* =========================================================
WEIGHTED PRICE
========================================================= */

function getWeightedAveragePrice(
    prices
) {

    let total =
        0;

    let weight =
        0;


    prices.forEach(
        item => {

            total +=
                item.price *
                item.weight;

            weight +=
                item.weight;
        }
    );


    if (!weight) {
        return 0;
    }


    return total / weight;
}


/* =========================================================
HELPERS FOR RECOMMENDATIONS
========================================================= */

function normalizeText(value) {

    return String(
        value || ""
    )
        .toLowerCase()
        .trim();
}


function findProductById(id) {

    const target =
        String(id);


    return allProducts.find(
        product =>
            String(product.id) ===
            target
    );
}


function shuffleArray(array) {

    const result =
        [...array];


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            result[i],
            result[j]
        ] =
        [
            result[j],
            result[i]
        ];
    }


    return result;
}


/* =========================================================
VIEWED HELPERS
========================================================= */

function isProductViewed(
    product
) {

    if (!product) {
        return false;
    }


    const id =
        String(product.id);


    return viewedProducts.some(
        viewedId =>
            String(viewedId) === id
    );
}


function findNextUnviewedIndex(
    startIndex,
    direction
) {

    if (!products.length) {
        return -1;
    }


    /*
    Ищем следующий товар,
    который ещё не просмотрен.

    direction:
    +1 = вперёд
    -1 = назад
    */

    for (
        let step = 1;
        step <= products.length;
        step++
    ) {

        let index =
            startIndex +
            direction *
            step;


        while (
            index < 0
        ) {
            index +=
                products.length;
        }


        while (
            index >= products.length
        ) {
            index -=
                products.length;
        }


        const product =
            products[index];


        if (
            !isProductViewed(
                product
            )
        ) {

            return index;
        }
    }


    return -1;
}


/* =========================================================
SHOW PRODUCT
========================================================= */

function showProduct() {

    if (!products.length) {
        showEmptyFeed();
        return;
    }


    const productCard =
        document.getElementById(
            "productCard"
        );

    const feedEmpty =
        document.getElementById(
            "feedEmpty"
        );


    /*
    Если до этого была пустая лента,
    возвращаем карточку.
    */

    if (productCard) {
        productCard.style.display =
            "";
    }


    if (feedEmpty) {
        feedEmpty.style.display =
            "none";
    }


    if (
        currentIndex < 0
    ) {

        currentIndex =
            products.length - 1;
    }


    if (
        currentIndex >= products.length
    ) {

        currentIndex = 0;
    }


    currentProduct =
        products[currentIndex];


    /*
    На всякий случай не показываем
    уже просмотренный товар.
    */

    if (
        isProductViewed(
            currentProduct
        )
    ) {

        const nextIndex =
            findNextUnviewedIndex(
                currentIndex,
                1
            );


        if (
            nextIndex === -1
        ) {

            showEmptyFeed();

            return;
        }


        currentIndex =
            nextIndex;


        currentProduct =
            products[currentIndex];
    }


    const image =
        document.getElementById(
            "productImage"
        );

    const title =
        document.getElementById(
            "productTitle"
        );

    const brand =
        document.getElementById(
            "productBrand"
        );

    const source =
        document.getElementById(
            "productSource"
        );

    const price =
        document.getElementById(
            "productPrice"
        );

    const oldPrice =
        document.getElementById(
            "productOldPrice"
        );

    const rating =
        document.getElementById(
            "productRating"
        );

    const category =
        document.getElementById(
            "productCategory"
        );


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
        sourceLabel(
            currentProduct.source
        );


    price.textContent =
        formatPrice(
            currentProduct
        );


    if (
        currentProduct.oldPrice
    ) {

        oldPrice.textContent =
            formatPrice({
                price:
                    currentProduct.oldPrice,

                currency:
                    currentProduct.currency
            });

    } else {

        oldPrice.textContent =
            "";
    }


    if (
        currentProduct.rating !== ""
    ) {

        rating.textContent =
            "★ " +
            currentProduct.rating;

    } else {

        rating.textContent =
            "★ —";
    }


    category.textContent =
        currentProduct.category ||
        "Одежда";


    updateLikeButton();


    /*
    Товар считается просмотренным,
    когда реально показан пользователю.
    */

    registerView(
        currentProduct
    );


    resetCardPosition();
}


/* =========================================================
EMPTY FEED
========================================================= */

function showEmptyFeed() {

    const productCard =
        document.getElementById(
            "productCard"
        );

    const feedEmpty =
        document.getElementById(
            "feedEmpty"
        );


    if (productCard) {

        productCard.style.display =
            "none";
    }


    if (feedEmpty) {

        feedEmpty.style.display =
            "flex";
    }
}


/* =========================================================
TABS
========================================================= */

function switchTab(tab) {

    currentTab = tab;


    const screens = {

        feed:
            "feedScreen",

        favorites:
            "favoritesScreen",

        search:
            "searchScreen",

        profile:
            "profileScreen"
    };


    Object.values(
        screens
    ).forEach(
        id => {

            document
                .getElementById(id)
                .classList
                .remove("active");
        }
    );


    document
        .getElementById(
            screens[tab]
        )
        .classList
        .add("active");


    const navs = {

        feed:
            "navFeed",

        favorites:
            "navFavorites",

        search:
            "navSearch",

        profile:
            "navProfile"
    };


    Object.values(
        navs
    ).forEach(
        id => {

            document
                .getElementById(id)
                .classList
                .remove("active");
        }
    );


    document
        .getElementById(
            navs[tab]
        )
        .classList
        .add("active");


    if (
        tab === "favorites"
    ) {

        renderFavorites();
    }


    if (
        tab === "profile"
    ) {

        updateProfile();
    }


    if (
        tab === "search"
    ) {

        setTimeout(
            () => {

                document
                    .getElementById(
                        "searchInput"
                    )
                    .focus();

            },
            100
        );
    }
}


/* =========================================================
FAVORITES
========================================================= */

function isFavorite(
    productId
) {

    return favorites.some(
        item =>
            String(item.id) ===
            String(productId)
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

        favorites.splice(
            index,
            1
        );


        showToast(
            "Удалено из избранного"
        );

    } else {

        favorites.unshift(
            currentProduct
        );


        showToast(
            "❤️ Добавлено в избранное"
        );


        showHeart();
    }


    saveJSON(
        "styleflow_favorites",
        favorites
    );


    /*
    После лайка перестраиваем
    персональную ленту.

    Новый интерес пользователя
    сразу начинает влиять
    на следующие товары.
    */

    rebuildFeedAfterSignal();


    updateLikeButton();

    updateProfile();
}


/* =========================================================
LIKE BUTTON
========================================================= */

function updateLikeButton() {

    const button =
        document.getElementById(
            "likeButton"
        );


    if (!button || !currentProduct) {
        return;
    }


    const icon =
        button.querySelector(
            ".action-icon"
        );


    if (
        isFavorite(
            currentProduct.id
        )
    ) {

        button.classList.add(
            "liked"
        );


        if (icon) {

            icon.textContent =
                "❤️";
        }

    } else {

        button.classList.remove(
            "liked"
        );


        if (icon) {

            icon.textContent =
                "♥";
        }
    }
}


/* =========================================================
REBUILD AFTER USER ACTION
========================================================= */

function rebuildFeedAfterSignal() {

    const currentId =
        currentProduct
            ? String(currentProduct.id)
            : null;


    buildPersonalizedFeed();


    /*
    Текущий товар уже просмотрен,
    поэтому он не должен возвращаться
    в новую ленту.
    */

    if (
        currentId
    ) {

        products =
            products.filter(
                product =>
                    String(product.id) !==
                    currentId
            );
    }


    /*
    После перестроения начинаем
    с первого подходящего товара.
    */

    currentIndex = 0;


    /*
    Если после перестроения товаров нет,
    показываем пустую ленту.
    */

    if (!products.length) {

        showEmptyFeed();

        return;
    }


    /*
    Важно:
    текущую карточку не меняем мгновенно.
    Пользователь сначала может открыть
    товар/лайкнуть его, а следующая
    карточка будет выбрана при свайпе.
    */
}


/* =========================================================
FAVORITES RENDER
========================================================= */

function renderFavorites() {

    const grid =
        document.getElementById(
            "favoritesGrid"
        );

    const empty =
        document.getElementById(
            "favoritesEmpty"
        );


    grid.innerHTML = "";


    if (!favorites.length) {

        empty.style.display =
            "flex";

        return;
    }


    empty.style.display =
        "none";


    favorites.forEach(
        product => {

            const card =
                document.createElement(
                    "div"
                );


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


            card.onclick =
                () => {

                    openProductFromObject(
                        product
                    );
                };


            grid.appendChild(
                card
            );
        }
    );
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


    registerOpen(
        currentProduct
    );


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


function openProductFromObject(
    product
) {

    const index =
        products.findIndex(
            item =>
                String(item.id) ===
                String(product.id)
        );


    if (index >= 0) {

        currentIndex =
            index;


        showProduct();


        switchTab(
            "feed"
        );


        return;
    }


    currentProduct =
        product;


    registerView(
        product
    );


    renderSingleProductObject(
        product
    );


    switchTab(
        "feed"
    );
}


function renderSingleProductObject(
    product
) {

    const productCard =
        document.getElementById(
            "productCard"
        );

    const feedEmpty =
        document.getElementById(
            "feedEmpty"
        );


    if (productCard) {

        productCard.style.display =
            "";
    }


    if (feedEmpty) {

        feedEmpty.style.display =
            "none";
    }


    document.getElementById(
        "productImage"
    ).src =
        product.image;


    document.getElementById(
        "productTitle"
    ).textContent =
        product.title;


    document.getElementById(
        "productBrand"
    ).textContent =
        product.brand ||
        "StyleFlow";


    document.getElementById(
        "productSource"
    ).textContent =
        sourceLabel(
            product.source
        );


    document.getElementById(
        "productPrice"
    ).textContent =
        formatPrice(
            product
        );


    document.getElementById(
        "productOldPrice"
    ).textContent =
        product.oldPrice
            ? formatPrice({
                price:
                    product.oldPrice,

                currency:
                    product.currency
            })
            : "";


    document.getElementById(
        "productRating"
    ).textContent =
        product.rating
            ? "★ " +
              product.rating
            : "★ —";


    document.getElementById(
        "productCategory"
    ).textContent =
        product.category ||
        "Одежда";


    updateLikeButton();

    resetCardPosition();
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
        comments
            .map(
                comment => `

                    <div class="comment">

                        <div class="comment-user">
                            ${escapeHTML(comment.user)}
                        </div>

                        <div class="comment-text">
                            ${escapeHTML(comment.text)}
                        </div>

                    </div>

                `
            )
            .join("");


    overlay.classList.add(
        "show"
    );
}


function closeComments(event) {

    if (
        !event ||
        event.target.id ===
            "commentsOverlay"
    ) {

        document
            .getElementById(
                "commentsOverlay"
            )
            .classList
            .remove("show");
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


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            const value =
                input.value.trim();


            document
                .getElementById(
                    "searchClear"
                )
                .style.display =
                    value
                        ? "flex"
                        : "none";


            clearTimeout(
                searchTimer
            );


            searchTimer =
                setTimeout(
                    () =>
                        performSearch(
                            value
                        ),
                    150
                );
        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();


                performSearch(
                    input.value.trim()
                );
            }
        }
    );
}


function quickSearch(query) {

    switchTab(
        "search"
    );


    const input =
        document.getElementById(
            "searchInput"
        );


    input.value =
        query;


    document
        .getElementById(
            "searchClear"
        )
        .style.display =
            "flex";


    performSearch(
        query
    );
}


function clearSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );


    input.value = "";


    document
        .getElementById(
            "searchClear"
        )
        .style.display =
            "none";


    document
        .getElementById(
            "searchResults"
        )
        .classList
        .remove("active");


    document
        .getElementById(
            "searchHome"
        )
        .style.display =
            "block";


    input.focus();
}


function performSearch(
    query
) {

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

        home.style.display =
            "block";


        results.classList.remove(
            "active"
        );


        return;
    }


    home.style.display =
        "none";


    results.classList.add(
        "active"
    );


    const normalizedQuery =
        query
            .toLowerCase()
            .trim();


    const tokens =
        normalizedQuery
            .split(/\s+/)
            .filter(Boolean);


    const filtered =
        allProducts.filter(
            product => {

                const searchable = [

                    product.title,

                    product.brand,

                    product.category,

                    product.source,

                    sourceLabel(
                        product.source
                    )

                ]
                    .join(" ")
                    .toLowerCase();


                return tokens.every(
                    token =>
                        searchable.includes(
                            token
                        )
                );
            }
        );


    resultCount.textContent =
        filtered.length === 1
            ? "Найден 1 товар"
            : `Найдено товаров: ${filtered.length}`;


    resultList.innerHTML = "";


    if (!filtered.length) {

        resultList.innerHTML = `

            <div
                class="empty"
                style="
                    position:relative;
                    min-height:300px;
                "
            >

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


    filtered.forEach(
        product => {

            const card =
                document.createElement(
                    "div"
                );


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
                            sourceLabel(
                                product.source
                            )
                        )}
                    </div>

                    <div class="result-title">
                        ${escapeHTML(
                            product.title
                        )}
                    </div>

                    <div class="result-price">
                        ${escapeHTML(
                            formatPrice(
                                product
                            )
                        )}
                    </div>

                </div>

            `;


            card.onclick =
                () => {

                    openProductFromObject(
                        product
                    );
                };


            resultList.appendChild(
                card
            );
        }
    );
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


    if (likedCount) {

        likedCount.textContent =
            favorites.length;
    }


    if (viewedCount) {

        viewedCount.textContent =
            viewedProducts.length;
    }


    if (openedCount) {

        openedCount.textContent =
            openedProducts.length;
    }


    if (collectionCount) {

        collectionCount.textContent =
            `${favorites.length} ${
                getRussianPlural(
                    favorites.length,
                    "товар",
                    "товара",
                    "товаров"
                )
            }`;
    }


    renderRecentProducts();
}


function renderRecentProducts() {

    const grid =
        document.getElementById(
            "recentGrid"
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    const recentIds =
        [...viewedProducts]
            .reverse()
            .slice(0, 6);


    const recent =
        recentIds
            .map(
                id =>
                    allProducts.find(
                        product =>
                            String(product.id) ===
                            String(id)
                    )
            )
            .filter(Boolean);


    recent.forEach(
        product => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "recent-card";


            card.innerHTML = `

                <img
                    src="${escapeAttribute(product.image)}"
                    alt="${escapeAttribute(product.title)}"
                >

                <div class="recent-price">
                    ${escapeHTML(
                        formatPrice(
                            product
                        )
                    )}
                </div>

            `;


            card.onclick =
                () => {

                    openProductFromObject(
                        product
                    );
                };


            grid.appendChild(
                card
            );
        }
    );


    if (!recent.length) {

        grid.innerHTML = `

            <div
                style="
                    grid-column:1/-1;
                    padding:25px 5px;
                    color:rgba(255,255,255,.4);
                    font-size:13px;
                "
            >
                Начни листать ленту —
                здесь появятся твои находки.
            </div>

        `;
    }
}


function openCollection(
    type
) {

    if (
        type === "favorites"
    ) {

        switchTab(
            "favorites"
        );
    }
}


/* =========================================================
VIEW TRACKING
========================================================= */

function registerView(
    product
) {

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

        viewedProducts.push(
            id
        );


        if (
            viewedProducts.length >
            500
        ) {

            viewedProducts.shift();
        }


        saveJSON(
            "styleflow_viewed",
            viewedProducts
        );


        console.log(
            "[StyleFlow] Просмотрен товар:",
            product.title
        );


        updateProfile();
    }
}


/* =========================================================
OPEN TRACKING
========================================================= */

function registerOpen(
    product
) {

    if (!product) {
        return;
    }


    const id =
        String(product.id);


    openedProducts.push(
        id
    );


    if (
        openedProducts.length >
        500
    ) {

        openedProducts.shift();
    }


    saveJSON(
        "styleflow_opened",
        openedProducts
    );


    /*
    Открытие товара —
    сильный сигнал интереса.

    Пересобираем оставшуюся ленту
    под новое действие пользователя.
    */

    rebuildFeedAfterSignal();


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


    if (!card) {
        return;
    }


    card.addEventListener(
        "touchstart",
        event => {

            if (!currentProduct) {
                return;
            }


            touchStartY =
                event.touches[0]
                    .clientY;


            touchStartX =
                event.touches[0]
                    .clientX;


            isDragging =
                true;


            card.classList.add(
                "dragging"
            );
        },
        {
            passive: true
        }
    );


    card.addEventListener(
        "touchmove",
        event => {

            if (!isDragging) {
                return;
            }


            const y =
                event.touches[0]
                    .clientY;


            const x =
                event.touches[0]
                    .clientX;


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
        {
            passive: false
        }
    );


    card.addEventListener(
        "touchend",
        event => {

            if (!isDragging) {
                return;
            }


            isDragging =
                false;


            card.classList.remove(
                "dragging"
            );


            const touch =
                event.changedTouches[0];


            const deltaY =
                touch.clientY -
                touchStartY;


            card.style.transform =
                "";


            if (
                Math.abs(deltaY) >
                80
            ) {

                if (
                    deltaY < 0
                ) {

                    nextProduct();

                } else {

                    previousProduct();
                }


                return;
            }


            const now =
                Date.now();


            if (
                now - lastTapTime <
                350
            ) {

                toggleLike();
            }


            lastTapTime =
                now;
        },
        {
            passive: true
        }
    );


    let wheelLocked =
        false;


    card.addEventListener(
        "wheel",
        event => {

            if (wheelLocked) {
                return;
            }


            wheelLocked =
                true;


            if (
                event.deltaY > 0
            ) {

                nextProduct();

            } else {

                previousProduct();
            }


            setTimeout(
                () => {

                    wheelLocked =
                        false;

                },
                300
            );
        },
        {
            passive: true
        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                currentTab !==
                "feed"
            ) {
                return;
            }


            if (
                event.key ===
                    "ArrowDown" ||
                event.key ===
                    "ArrowRight"
            ) {

                nextProduct();
            }


            if (
                event.key ===
                    "ArrowUp" ||
                event.key ===
                    "ArrowLeft"
            ) {

                previousProduct();
            }
        }
    );
}


/* =========================================================
NEXT / PREVIOUS
========================================================= */

function nextProduct() {

    if (!products.length) {

        buildPersonalizedFeed();

        currentIndex = 0;


        if (!products.length) {

            showEmptyFeed();

            return;
        }


        showProduct();

        return;
    }


    /*
    Ищем следующий непросмотренный товар.
    */

    const nextIndex =
        findNextUnviewedIndex(
            currentIndex,
            1
        );


    if (
        nextIndex >= 0
    ) {

        currentIndex =
            nextIndex;


        animateCardChange(
            "next"
        );


        return;
    }


    /*
    Все товары из текущего набора
    уже просмотрены.

    Проверяем, остались ли вообще
    какие-либо товары, которые можно
    показать.
    */

    const unviewed =
        allProducts.filter(
            product =>
                !isProductViewed(
                    product
                )
        );


    if (unviewed.length > 0) {

        buildPersonalizedFeed();

        currentIndex = 0;


        if (products.length > 0) {

            animateCardChange(
                "next"
            );

        } else {

            showEmptyFeed();
        }


        return;
    }


    /*
    Пользователь просмотрел абсолютно
    все товары.

    Начинаем новый круг.
    */

    console.log(
        "[StyleFlow] Все товары просмотрены — новый круг"
    );


    viewedProducts = [];


    saveJSON(
        "styleflow_viewed",
        viewedProducts
    );


    buildPersonalizedFeed();


    currentIndex = 0;


    if (products.length > 0) {

        animateCardChange(
            "next"
        );

    } else {

        showEmptyFeed();
    }
}


function previousProduct() {

    if (!products.length) {
        return;
    }


    /*
    Назад также ищет только
    непросмотренный товар.

    Это не позволяет пользователю
    случайно вернуть уже просмотренную
    карточку.
    */

    const previousIndex =
        findNextUnviewedIndex(
            currentIndex,
            -1
        );


    if (
        previousIndex < 0
    ) {

        showToast(
            "Больше непросмотренных товаров нет"
        );


        return;
    }


    currentIndex =
        previousIndex;


    animateCardChange(
        "previous"
    );
}


/* =========================================================
CARD ANIMATION
========================================================= */

function animateCardChange(
    direction
) {

    const card =
        document.getElementById(
            "productCard"
        );


    if (!card) {
        return;
    }


    card.style.opacity =
        "0";


    card.style.transform =
        direction === "next"
            ? "translateY(-20px)"
            : "translateY(20px)";


    setTimeout(
        () => {

            showProduct();


            requestAnimationFrame(
                () => {

                    card.style.opacity =
                        "1";


                    card.style.transform =
                        "";
                }
            );

        },
        100
    );
}


function resetCardPosition() {

    const card =
        document.getElementById(
            "productCard"
        );


    if (!card) {
        return;
    }


    card.style.opacity =
        "1";


    card.style.transform =
        "";
}


/* =========================================================
HEART
========================================================= */

function showHeart() {

    const heart =
        document.getElementById(
            "bigHeart"
        );


    if (!heart) {
        return;
    }


    heart.classList.remove(
        "show"
    );


    void heart.offsetWidth;


    heart.classList.add(
        "show"
    );
}


/* =========================================================
TOAST
========================================================= */

let toastTimer =
    null;


function showToast(
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            1800
        );
}


/* =========================================================
LOCAL STORAGE
========================================================= */

function loadJSON(
    key,
    fallback
) {

    try {

        const value =
            localStorage.getItem(
                key
            );


        if (!value) {
            return fallback;
        }


        const parsed =
            JSON.parse(value);


        return parsed ??
            fallback;

    } catch (error) {

        return fallback;
    }
}


function saveJSON(
    key,
    value
) {

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
ESCAPING
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
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

    return escapeHTML(
        value
    );
}


function capitalize(
    value
) {

    const text =
        String(
            value || ""
        );


    if (!text) {
        return "";
    }


    return (
        text.charAt(0)
            .toUpperCase() +
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
        Math.abs(number) %
        100;

    const n1 =
        n % 10;


    if (
        n > 10 &&
        n < 20
    ) {

        return many;
    }


    if (
        n1 === 1
    ) {

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
