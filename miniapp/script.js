/* =========================================================
STYLEFLOW
Personalized marketplace feed

ЭТАП 4:

1. Новая лента сначала максимально случайная.
2. Не показываем уже просмотренные товары.
3. История просмотров хранится на сервере.
4. История привязана к Telegram user.id.
5. Постепенно собираем интересы пользователя.
6. Персонализация усиливается по мере накопления сигналов.
7. Даже персонализированная лента сохраняет случайные товары.
8. Не допускаем длинных серий одной категории/площадки.
9. Учитываем:
    * категории
    * бренды
    * маркетплейсы
    * цены
    * лайки
    * открытия товаров
    * просмотры

10. Добавлены фильтры:
    * минимальная цена
    * максимальная цена
    * категория
    * маркетплейс

Фильтры применяются ДО персонализации.

Локальный localStorage используется как кэш,
а сервер является источником пользовательской истории.

========================================================= */


/* =========================================================
GLOBAL
========================================================= */

let allProducts = [];
let products = [];
let currentIndex = 0;
let currentProduct = null;

// История карточек именно текущей сессии ленты.
let navigationHistory = [];
let navigationPosition = -1;

let favorites = loadJSON(
    "styleflow_favorites",
    []
);

let viewedProducts = loadJSON(
    "styleflow_viewed",
    []
);

let openedProducts = loadJSON(
    "styleflow_opened",
    []
);

let currentTab = "feed";

let touchStartY = 0;
let touchStartX = 0;
let isDragging = false;
let lastTapTime = 0;
let searchTimer = null;

// Серверный lazy-поиск.
// Храним активный запрос, чтобы при свайпе догружать следующие страницы.
let activeServerSearch = {
    query: "",
    sources: [],
    minPrice: null,
    maxPrice: null
};

let serverSearchLoading = false;
let serverSearchRequestId = 0;
let serverSearchHasMore = true;
let serverSearchLastFetchAt = 0;

let feedOffset = 0;
let feedHasMore = true;
let feedLoading = false;
const FEED_PAGE_SIZE = 120;
const FEED_PREFETCH_THRESHOLD = 12;

const NAVIGATION_HISTORY_LIMIT = 150;
let productDetailsCollapsed = false;


/* =========================================================
SERVER USER HISTORY
========================================================= */

let telegramUserId = null;
let styleflowAccountId = null;
let styleflowAccount = null;

let userHistoryLoaded = false;


/* =========================================================
FILTERS
========================================================= */

let activeFilters = loadJSON(
    "styleflow_filters",
    {
        query: "",
        minPrice: null,
        maxPrice: null,
        categories: [],
        sources: [],
        sort: "relevance"
    }
);


/*
Защита от старого/битого localStorage.
*/

if (
    !activeFilters ||
    typeof activeFilters !== "object"
) {

    activeFilters = {
        query: "",
        minPrice: null,
        maxPrice: null,
        categories: [],
        sources: [],
        sort: "relevance"
    };
}


if (
    !Array.isArray(
        activeFilters.categories
    )
) {

    activeFilters.categories = [];
}

activeFilters.categories =
    activeFilters.categories
        .map(
            category =>
                getFilterCategoryLabel(
                    category
                )
        )
        .filter(Boolean);


if (
    !Array.isArray(
        activeFilters.sources
    )
) {

    activeFilters.sources = [];
}

if (!activeFilters.sort) {
    activeFilters.sort = "relevance";
}


/* =========================================================
RECOMMENDATION SETTINGS
========================================================= */

const PERSONALIZATION_START =
    3;

const PERSONALIZATION_FULL =
    40;

// Новому пользователю оставляем больше исследования каталога.
// По мере накопления сигналов случайность уменьшается.
const MIN_RANDOM_RATIO =
    0.10;

const MAX_RANDOM_RATIO =
    0.35;


const MAX_SAME_CATEGORY_STREAK =
    2;

const MAX_SAME_SOURCE_STREAK =
    3;


/* =========================================================
TELEGRAM
========================================================= */

if (
    window.Telegram &&
    Telegram.WebApp
) {

    Telegram.WebApp.ready();

    Telegram.WebApp.expand();

    // Telegram иначе может принять вертикальный свайп карточки
    // за жест закрытия/сворачивания Mini App.
    try {

        if (typeof Telegram.WebApp.disableVerticalSwipes === "function") {
            Telegram.WebApp.disableVerticalSwipes();
        }

    } catch (e) {}

    try {

        Telegram.WebApp.setHeaderColor(
            "#09090d"
        );

        Telegram.WebApp.setBackgroundColor(
            "#09090d"
        );

    } catch (e) {}
}


/* =========================================================
GET TELEGRAM USER ID
========================================================= */

function getTelegramUserId() {

    try {
        if (
            window.Telegram &&
            Telegram.WebApp &&
            Telegram.WebApp.initDataUnsafe &&
            Telegram.WebApp.initDataUnsafe.user
        ) {
            return String(Telegram.WebApp.initDataUnsafe.user.id);
        }
    } catch (error) {
        console.error("[StyleFlow] Ошибка получения Telegram user.id:", error);
    }

    return "";
}


function getTelegramInitData() {
    try {
        if (window.Telegram && Telegram.WebApp) {
            return String(Telegram.WebApp.initData || "");
        }
    } catch (error) {
        console.error("[StyleFlow] Ошибка получения Telegram initData:", error);
    }
    return "";
}


async function authenticateTelegram() {
    const initData = getTelegramInitData();
    if (!initData) return false;

    try {
        const response = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({init_data: initData}),
            cache: "no-store"
        });

        const data = await response.json();

        if (data && data.verified && data.user_id) {
            telegramUserId = String(data.user_id);
            styleflowAccountId = data.account_id ? String(data.account_id) : null;
            styleflowAccount = data.account || null;

            // После входа переключаем весь пользовательский кэш
            // на конкретный STYLEFLOW account.
            hydrateAccountLocalState();
            renderStyleflowAccount();
            console.log(
                "[StyleFlow] STYLEFLOW аккаунт подтверждён:",
                styleflowAccount ? styleflowAccount.id : "unknown",
                "Telegram:",
                telegramUserId
            );
            return true;
        }
    } catch (error) {
        console.error("[StyleFlow] Ошибка Telegram auth:", error);
    }

    return false;
}



function renderStyleflowAccount() {
    const nameElement = document.getElementById("profileName");
    const avatarElement = document.getElementById("profileAvatar");
    const subtitleElement = document.getElementById("profileAccountSubtitle");
    const badgeElement = document.getElementById("profileAccountBadge");

    if (!styleflowAccount) {
        if (nameElement) nameElement.textContent = "Style Explorer";
        if (avatarElement) avatarElement.textContent = "S";
        if (subtitleElement) subtitleElement.textContent = "Откройте STYLEFLOW из Telegram для регистрации";
        if (badgeElement) {
            badgeElement.textContent = "Не авторизован";
            badgeElement.classList.remove("authenticated");
        }
        return;
    }

    const name = styleflowAccount.name || "Пользователь STYLEFLOW";
    const username = styleflowAccount.username
        ? `@${styleflowAccount.username}`
        : "Аккаунт STYLEFLOW";

    if (nameElement) nameElement.textContent = name;
    if (subtitleElement) subtitleElement.textContent = username;

    if (avatarElement) {
        if (styleflowAccount.photo_url) {
            avatarElement.innerHTML = `<img src="${escapeAttribute(styleflowAccount.photo_url)}" alt="">`;
            avatarElement.classList.add("has-photo");
        } else {
            avatarElement.textContent = String(name).trim().charAt(0).toUpperCase() || "S";
            avatarElement.classList.remove("has-photo");
        }
    }

    if (badgeElement) {
        badgeElement.textContent = "Аккаунт STYLEFLOW";
        badgeElement.classList.add("authenticated");
    }
}


async function logoutStyleflow() {
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.error("[StyleFlow] Ошибка выхода:", error);
    }

    styleflowAccount = null;
    styleflowAccountId = null;
    telegramUserId = null;
    favorites = [];
    viewedProducts = [];
    openedProducts = [];
    renderStyleflowAccount();
}


function showAccountRequiredState() {
    const productCard = document.getElementById("productCard");
    const feedEmpty = document.getElementById("feedEmpty");
    if (productCard) productCard.style.display = "none";
    if (feedEmpty) {
        feedEmpty.style.display = "";
        feedEmpty.innerHTML = `
            <div class="empty-title">Войдите в STYLEFLOW</div>
            <div class="empty-text">Откройте Mini App через кнопку регистрации в Telegram-боте.</div>
        `;
    }
}


/* =========================================================
START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupSearch();
        setupSearchSources();
        setupSearchSuggestionFocus();
        setupSwipe();

        telegramUserId = getTelegramUserId();
        renderStyleflowAccount();

        console.log(
            "[StyleFlow] Telegram user ID:",
            telegramUserId || "не найден"
        );

        renderCachedFeedImmediately();

        const authenticated = await authenticateTelegram();

        if (!authenticated) {
            console.warn("[StyleFlow] Пользователь не авторизован в STYLEFLOW. Ожидаем вход через Telegram.");
            showAccountRequiredState();
            return;
        }

        await loadAccountFavorites();
        await loadUserHistory();
        await loadFeed();

        if (!activeServerSearch.query) {
            rebuildFeedKeepingPosition();
        }

        updateProfile();
        updateProfileInterests();
    }
);


/* =========================================================
LOAD USER HISTORY
========================================================= */

async function loadUserHistory() {

    if (!styleflowAccountId) {
        userHistoryLoaded = true;
        return;
    }


    try {

        const response =
            await fetch(
                `/api/user/history`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `History request failed: ${response.status}`
            );
        }


        const data =
            await response.json();


        console.log(
            "[StyleFlow] История сервера:",
            data
        );


        if (
            data &&
            data.status === "ok"
        ) {

            // Серверная история — источник истины для аккаунта.
            // Локальный кэш только дополняет её, но не смешивается
            // с данными другого STYLEFLOW аккаунта.
            viewedProducts =
                mergeUniqueIds(
                    viewedProducts,
                    Array.isArray(
                        data.viewed
                    )
                        ? data.viewed
                        : []
                );


            openedProducts =
                mergeIds(
                    openedProducts,
                    Array.isArray(
                        data.opened
                    )
                        ? data.opened
                        : []
                );


            if (
                viewedProducts.length >
                150
            ) {

                viewedProducts =
                    viewedProducts.slice(
                        -150
                    );
            }


            if (
                openedProducts.length >
                500
            ) {

                openedProducts =
                    openedProducts.slice(
                        -500
                    );
            }


            saveJSON(
                "styleflow_viewed",
                viewedProducts
            );


            saveJSON(
                "styleflow_opened",
                openedProducts
            );


            console.log(
                "[StyleFlow] История объединена.",
                "Viewed:",
                viewedProducts.length,
                "Opened:",
                openedProducts.length
            );
        }


        userHistoryLoaded = true;

    } catch (error) {

        console.error(
            "[StyleFlow] Ошибка загрузки истории:",
            error
        );


        userHistoryLoaded = true;
    }
}


/* =========================================================
MERGE UNIQUE IDS
========================================================= */

function mergeUniqueIds(
    existing,
    incoming
) {

    const result = [];

    const seen =
        new Set();


    [
        ...(Array.isArray(existing)
            ? existing
            : []),

        ...(Array.isArray(incoming)
            ? incoming
            : [])
    ].forEach(
        id => {

            const normalized =
                String(id);


            if (
                !seen.has(
                    normalized
                )
            ) {

                seen.add(
                    normalized
                );

                result.push(
                    normalized
                );
            }
        }
    );


    return result;
}


/* =========================================================
MERGE IDS
========================================================= */

function mergeIds(
    existing,
    incoming
) {

    const result = [];


    [
        ...(Array.isArray(existing)
            ? existing
            : []),

        ...(Array.isArray(incoming)
            ? incoming
            : [])
    ].forEach(
        id => {

            result.push(
                String(id)
            );
        }
    );


    return result;
}


/* =========================================================
SYNC USER ACTION
========================================================= */

async function syncUserAction(
    action,
    productId
) {

    if (
        !telegramUserId ||
        !productId
    ) {

        return;
    }


    let endpoint;


    if (
        action === "view"
    ) {

        endpoint =
            "/api/user/view";

    } else if (
        action === "open"
    ) {

        endpoint =
            "/api/user/open";

    } else {

        return;
    }


    try {

        await fetch(
            endpoint,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    product_id:
                        String(
                            productId
                        )
                })
            }
        );

    } catch (error) {

        console.error(
            `[StyleFlow] Ошибка синхронизации ${action}:`,
            error
        );
    }
}


/* =========================================================
LOAD FEED
========================================================= */

function renderCachedFeedImmediately() {
    if (activeServerSearch.query) return false;

    const cached = loadJSON("styleflow_main_feed", []);
    if (!Array.isArray(cached) || !cached.length) return false;

    allProducts = cached.map(normalizeProduct);
    feedOffset = allProducts.length;

    populateFilterCategories();
    renderFilterSources();
    buildPersonalizedFeed();

    if (products.length) {
        currentIndex = 0;
        resetNavigationHistory();
        showProduct();
        rememberCurrentProduct();
        preloadUpcomingImages();
        return true;
    }

    showEmptyFeed();
    return false;
}


function rebuildFeedKeepingPosition() {
    if (activeServerSearch.query) return;

    const currentId = currentProduct ? String(currentProduct.id) : "";
    buildPersonalizedFeed();

    if (!products.length) {
        showEmptyFeed();
        return;
    }

    let index = currentId
        ? products.findIndex(product => String(product.id) === currentId)
        : -1;

    if (index < 0) index = Math.min(currentIndex, products.length - 1);
    currentIndex = Math.max(0, index);
    showProduct(true);
    preloadUpcomingImages();
}


async function loadFeed() {
    const feedLoadSearchRequestId = serverSearchRequestId;

    renderCachedFeedImmediately();

    try {
        const response = await fetch(
            `/api/feed?limit=${FEED_PAGE_SIZE}&offset=0`,
            {cache: "no-store", credentials: "include"}
        );

        if (!response.ok) throw new Error("Feed request failed");

        const data = await response.json();

        if (
            feedLoadSearchRequestId !== serverSearchRequestId ||
            activeServerSearch.query
        ) return;

        const rawProducts = Array.isArray(data)
            ? data
            : (Array.isArray(data.products) ? data.products : []);

        const incoming = rawProducts.map(normalizeProduct);
        feedOffset = incoming.length;
        feedHasMore = data && data.has_more !== false;

        const hadCurrent = Boolean(currentProduct);
        mergeProductsIntoCatalog(incoming);
        localStorage.setItem("styleflow_main_feed", JSON.stringify(allProducts));

        populateFilterCategories();
        renderFilterSources();

        if (!hadCurrent) {
            buildPersonalizedFeed();
            currentIndex = 0;

            if (products.length) {
                resetNavigationHistory();
                showProduct();
                rememberCurrentProduct();
            } else {
                showEmptyFeed();
            }
        } else {
            appendNewRecommendedProducts(incoming);
        }

        preloadUpcomingImages();
        void maybeLoadMoreFeedProducts(true);

    } catch (error) {
        console.error("[StyleFlow] Feed error:", error);

        if (!allProducts.length) {
            renderCachedFeedImmediately();
        }
    }
}


async function loadMoreFeedProducts(force = false) {
    if (feedLoading || !feedHasMore || activeServerSearch.query) return false;

    if (!force && products.length - currentIndex - 1 > FEED_PREFETCH_THRESHOLD) {
        return false;
    }

    feedLoading = true;

    try {
        const response = await fetch(
            `/api/feed?limit=${FEED_PAGE_SIZE}&offset=${feedOffset}`,
            {cache: "no-store", credentials: "include"}
        );

        if (!response.ok) {
            throw new Error(`Feed page failed: ${response.status}`);
        }

        const data = await response.json();
        const incoming = Array.isArray(data.products)
            ? data.products.map(normalizeProduct)
            : [];

        if (!incoming.length) {
            feedHasMore = false;
            return false;
        }

        feedOffset += incoming.length;
        feedHasMore = data.has_more !== false;

        const beforeIds = new Set(allProducts.map(product => String(product.id)));
        const fresh = incoming.filter(product => !beforeIds.has(String(product.id)));

        mergeProductsIntoCatalog(fresh);
        localStorage.setItem("styleflow_main_feed", JSON.stringify(allProducts));

        if (fresh.length) {
            appendNewRecommendedProducts(fresh);
        }

        preloadUpcomingImages();
        return fresh.length > 0;

    } catch (error) {
        console.error("[StyleFlow] Ошибка догрузки общей ленты:", error);
        return false;
    } finally {
        feedLoading = false;
    }
}


async function maybeLoadMoreFeedProducts(force = false) {
    return loadMoreFeedProducts(force);
}


function appendNewRecommendedProducts(incoming) {
    if (!Array.isArray(incoming) || !incoming.length || activeServerSearch.query) {
        return;
    }

    const existing = new Set(products.map(product => String(product.id)));
    const viewed = new Set(viewedProducts.map(id => String(id)));

    const candidates = incoming.filter(product =>
        product &&
        !existing.has(String(product.id)) &&
        !viewed.has(String(product.id))
    );

    if (!candidates.length) return;

    const profile = buildUserProfile();
    const personalization = getPersonalizationStrength(profile.totalSignals);

    let additions;

    if (personalization <= 0) {
        additions = buildDiverseRandomFeed(shuffleArray(candidates));
    } else {
        additions = buildWeightedDiverseFeed(
            candidates.map(product => ({
                product,
                score: calculateRecommendationScore(product, profile)
            })),
            personalization
        );
    }

    products.push(...additions);
}


function preloadUpcomingImages() {
    const start = Math.max(0, currentIndex + 1);
    const end = Math.min(products.length, start + 10);

    for (let i = start; i < end; i++) {
        const product = products[i];
        const src = product && product.image;
        if (!src) continue;

        const img = new Image();
        img.decoding = "async";
        img.src = src;
    }
}



/* =========================================================
NORMALIZE PRODUCT
========================================================= */

function normalizeProduct(
    item,
    index = 0
) {

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


    const rawCategory =
        item.category ||
        item.type ||
        item.category_name ||
        item.product_category ||
        "";

    const category =
        getFilterCategoryLabel(
            rawCategory
        );


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
            normalizeSource(
                source
            ),

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

        description:
            item.description ||
            item.short_description ||
            item.subtitle ||
            item.details ||
            "",

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

        isAdult: Boolean(
            item.is_adult ??
            item.isAdult ??
            /дилдо|вибратор|фаллоимитатор|порно|порнография|эротик|интим|секс|sex|porn|dildo|vibrator|xxx|adult/i.test(
                `${title} ${brand} ${category} ${item.description || item.short_description || ""}`
            )
        ),

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


    if (
        value.includes(
            "wildberries"
        )
    ) {

        return "wildberries";
    }


    if (
        value.includes("ozon")
    ) {

        return "ozon";
    }


    if (
        value.includes(
            "aliexpress"
        )
    ) {

        return "aliexpress";
    }


    if (
        value.includes("kufar")
    ) {

        return "kufar";
    }


    return "marketplace";
}


function normalizeSource(
    source
) {

    const value =
        String(
            source || ""
        )
            .toLowerCase()
            .trim();


    if (
        value.includes("wild") ||
        value === "wb"
    ) {

        return "wildberries";
    }


    if (
        value.includes("ozon")
    ) {

        return "ozon";
    }


    if (
        value.includes("ali") ||
        value.includes("aliexpress")
    ) {

        return "aliexpress";
    }


    if (
        value.includes("kufar")
    ) {

        return "kufar";
    }


    return value ||
        "marketplace";
}


function sourceIcon(source) {
    const s = normalizeSearchSource(source);
    if (s.includes("kufar")) return "🟢";
    if (s.includes("wildberries") || s === "wb") return "🟣";
    if (s.includes("ozon")) return "🔵";
    if (s.includes("ali")) return "🟠";
    return "🛍️";
}

function sourceLabel(
    source
) {

    const labels = {

        wildberries:
            "🟣 Wildberries",

        ozon:
            "🔵 Ozon",

        aliexpress:
            "🟠 AliExpress",

        kufar:
            "🟢 Kufar",

        marketplace:
            "🛍 Marketplace"
    };


    return (
        labels[source] ||
        "🛍 " +
        capitalize(source)
    );
}


/* =========================================================
PRICE
========================================================= */

function parsePrice(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;
    }


    if (
        typeof value === "number"
    ) {

        return value;
    }


    const cleaned =
        String(value)
            .replace(
                /[^\d.,-]/g,
                ""
            )
            .replace(
                ",",
                "."
            );


    const number =
        Number(cleaned);


    return Number.isFinite(number)
        ? number
        : null;
}


function detectCurrency(
    item
) {

    const raw =
        String(
            item.currency ||
            item.price ||
            ""
        )
            .toLowerCase();


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


function formatPrice(
    product
) {

    if (
        product.price === null
    ) {

        return "Цена уточняется";
    }


    const currency =
        product.currency ||
        "BYN";


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
                    maximumFractionDigits:
                        2
                }
            )
        +
        " " +
        symbol
    );
}


/* =========================================================
FILTERS
========================================================= */


/*
Нормализуем категорию для фильтров.

Kufar/WB и другие источники могут отдавать
числовые ID категорий вместо названия.
Для интерфейса такие значения показываем как
"Одежда", чтобы в фильтре не появлялись
цепочки вроде 10501 / 105011030...
*/
function getFilterCategoryKey(value) {

    const text =
        String(value || "")
            .trim();

    if (!text) {
        return "";
    }

    const normalized =
        normalizeText(text);

    if (/^\d+$/.test(normalized)) {
        return "";
    }

    if (/^[\d\s._-]+$/.test(normalized)) {
        return "";
    }

    return normalized;
}


function getFilterCategoryLabel(value) {

    const text =
        String(value || "")
            .trim();

    if (!text) {
        return "";
    }

    const normalized =
        normalizeText(text);

    if (/^\d+$/.test(normalized)) {
        return "";
    }

    if (/^[\d\s._-]+$/.test(normalized)) {
        return "";
    }

    return text;
}


/*
Создаём кнопки площадок программно,
поэтому они всегда реально реагируют на клик.
*/
function renderFilterSources() {

    const container =
        document.getElementById(
            "filterSources"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const sources = [
        {
            key: "__all__",
            label: "Все"
        },
        {
            key: "kufar",
            label: "🟢 Kufar"
        },
        {
            key: "wildberries",
            label: "🟣 Wildberries"
        },
        {
            key: "ozon",
            label: "🔵 Ozon"
        },
        {
            key: "aliexpress",
            label: "🟠 AliExpress"
        }
    ];

    sources.forEach(
        source => {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";
            button.className = "filter-chip";
            button.dataset.source = source.key;
            button.textContent = source.label;

            button.addEventListener(
                "click",
                () => {
                    toggleFilterChip(button);
                }
            );

            container.appendChild(button);
        }
    );

    syncSourceFilterUI();
}


/*
Возвращает количество активных фильтров.
*/

function getActiveFilterCount() {

    let count = 0;


    if (
        String(activeFilters.query || "").trim()
    ) {
        count++;
    }


    if (
        activeFilters.minPrice !== null &&
        activeFilters.minPrice !== ""
    ) {

        count++;
    }


    if (
        activeFilters.maxPrice !== null &&
        activeFilters.maxPrice !== ""
    ) {

        count++;
    }


    if (
        Array.isArray(
            activeFilters.categories
        ) &&
        activeFilters.categories.length
    ) {

        count +=
            activeFilters.categories.length;
    }


    if (
        Array.isArray(
            activeFilters.sources
        ) &&
        activeFilters.sources.length
    ) {

        count +=
            activeFilters.sources.length;
    }


    return count;
}


/*
Открытие панели фильтров.
*/

function openFilters() {

    const overlay =
        document.getElementById(
            "filtersOverlay"
        );


    if (!overlay) {

        console.warn(
            "[StyleFlow] filtersOverlay не найден"
        );

        return;
    }


    populateFilterCategories();
    renderFilterSources();


    syncFilterUI();


    overlay.classList.add(
        "show"
    );


    document.body.classList.add(
        "filters-open"
    );
}


/*
Закрытие панели фильтров.
*/

function closeFilters(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id !==
            "filtersOverlay"
    ) {

        return;
    }


    const overlay =
        document.getElementById(
            "filtersOverlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "show"
        );
    }


    document.body.classList.remove(
        "filters-open"
    );
}


/*
Применить фильтры.
*/

function applyFilters() {

    const queryInput =
        document.getElementById(
            "filterQuery"
        );


    const query =
        queryInput
            ? queryInput.value.trim()
            : "";


    const minInput =
        document.getElementById(
            "filterMinPrice"
        );


    const maxInput =
        document.getElementById(
            "filterMaxPrice"
        );


    let minPrice =
        minInput
            ? parsePrice(
                minInput.value
            )
            : null;


    let maxPrice =
        maxInput
            ? parsePrice(
                maxInput.value
            )
            : null;


    /*
    Если пользователь случайно
    поставил максимум меньше минимума —
    меняем местами.
    */

    if (
        minPrice !== null &&
        maxPrice !== null &&
        minPrice > maxPrice
    ) {

        const temp =
            minPrice;

        minPrice =
            maxPrice;

        maxPrice =
            temp;
    }


    const categoryButtons =
        document.querySelectorAll(
            "#filterCategories .filter-chip.active"
        );


    const sourceButtons =
        document.querySelectorAll(
            "#filterSources .filter-chip.active"
        );


    const categories = [];


    categoryButtons.forEach(
        button => {

            const value =
                String(
                    button.dataset.category ||
                    ""
                )
                    .trim();


            if (
                value &&
                value !== "__all__"
            ) {

                categories.push(
                    value
                );
            }
        }
    );


    const sources = [];

    const sortSelect = document.getElementById("filterSort");
    const sort = sortSelect ? (sortSelect.value || "relevance") : "relevance";


    sourceButtons.forEach(
        button => {

            const value =
                String(
                    button.dataset.source ||
                    ""
                )
                    .trim();


            if (
                value &&
                value !== "__all__"
            ) {

                sources.push(
                    value
                );
            }
        }
    );


    activeFilters = {

        query,

        minPrice,

        maxPrice,

        categories:
            uniqueStrings(
                categories
            ),

        sources:
            uniqueStrings(
                sources
            ),

        sort
    };


    saveJSON(
        "styleflow_filters",
        activeFilters
    );


    /*
    После изменения фильтров строим ленту заново.
    Если указан текстовый запрос — сначала просим серверный lazy-каталог.
    */

    currentIndex = 0;

    if (query) {
        void performSearch(query, {
            sources: uniqueStrings(sources),
            minPrice,
            maxPrice
        });
        closeFilters();
        updateFilterButton();
        return;
    }

    buildPersonalizedFeed();


    // После применения фильтра сразу возвращаем человека в ленту.
    switchTab("feed");
    resetNavigationHistory();


    if (
        products.length > 0
    ) {

        showProduct();

    } else {

        showEmptyFeed();

        showToast(
            "По выбранным фильтрам товаров нет"
        );
    }


    closeFilters();


    updateFilterButton();


    console.log(
        "[StyleFlow] Фильтры применены:",
        activeFilters
    );
}


/*
Сброс фильтров.
*/

function resetFilters() {

    activeFilters = {
        query: "",
        minPrice: null,
        maxPrice: null,
        categories: [],
        sources: [],
        sort: "relevance"
    };


    saveJSON(
        "styleflow_filters",
        activeFilters
    );


    const queryInput =
        document.getElementById(
            "filterQuery"
        );


    if (queryInput) {
        queryInput.value = "";
    }


    const minInput =
        document.getElementById(
            "filterMinPrice"
        );


    const maxInput =
        document.getElementById(
            "filterMaxPrice"
        );


    if (minInput) {

        minInput.value = "";
    }


    if (maxInput) {

        maxInput.value = "";
    }


    syncFilterUI();

    activeServerSearch = {
        query: "",
        sources: [],
        minPrice: null,
        maxPrice: null
    };
    serverSearchHasMore = true;
    serverSearchRequestId++;

    currentIndex = 0;


    buildPersonalizedFeed();
    switchTab("feed");
    resetNavigationHistory();


    if (
        products.length > 0
    ) {

        showProduct();

    } else {

        showEmptyFeed();
    }


    updateFilterButton();


    showToast(
        "Фильтры сброшены"
    );
}


/*
Выбор категории/источника.

Можно вызывать из HTML:
toggleFilterChip(this)
*/

function toggleFilterChip(
    button
) {

    if (!button) {
        return;
    }


    const isAll =
        button.dataset.category ===
            "__all__" ||
        button.dataset.source ===
            "__all__";


    /*
    Если нажали "Все",
    снимаем остальные кнопки.
    */

    if (isAll) {

        const container =
            button.parentElement;


        if (container) {

            container
                .querySelectorAll(
                    ".filter-chip"
                )
                .forEach(
                    chip => {

                        chip.classList.remove(
                            "active"
                        );
                    }
                );
        }


        button.classList.add(
            "active"
        );


        return;
    }


    /*
    Обычная кнопка.

    Если она включается —
    выключаем "Все".
    */

    const container =
        button.parentElement;


    if (container) {

        const allButton =
            container.querySelector(
                '[data-category="__all__"], [data-source="__all__"]'
            );


        if (allButton) {

            allButton.classList.remove(
                "active"
            );
        }
    }


    button.classList.toggle(
        "active"
    );


    /*
    Если после выключения
    ничего не осталось —
    включаем "Все".
    */

    if (container) {

        const selected =
            container.querySelectorAll(
                ".filter-chip.active"
            );


        if (!selected.length) {

            const allButton =
                container.querySelector(
                    '[data-category="__all__"], [data-source="__all__"]'
                );


            if (allButton) {

                allButton.classList.add(
                    "active"
                );
            }
        }
    }
}


/*
Заполняем категории автоматически
из текущего каталога.
*/

function populateFilterCategories() {

    const container =
        document.getElementById(
            "filterCategories"
        );

    if (!container) {
        return;
    }

    const categoryMap =
        new Map();

    allProducts.forEach(
        product => {

            const label =
                getFilterCategoryLabel(
                    product && product.category
                );

            if (!label) {
                return;
            }

            const key =
                getFilterCategoryKey(label);

            if (!key) {
                return;
            }

            if (!categoryMap.has(key)) {
                categoryMap.set(
                    key,
                    label
                );
            }
        }
    );

    const categories =
        Array.from(
            categoryMap.entries()
        )
        .sort(
            (a, b) =>
                a[1].localeCompare(
                    b[1],
                    "ru"
                )
        );

    const availableKeys =
        new Set(
            categories.map(
                item => item[0]
            )
        );

    activeFilters.categories =
        activeFilters.categories
            .map(
                category =>
                    getFilterCategoryLabel(
                        category
                    )
            )
            .filter(
                category =>
                    availableKeys.has(
                        getFilterCategoryKey(
                            category
                        )
                    )
            );

    activeFilters.categories =
        uniqueStrings(
            activeFilters.categories
        );

    container.innerHTML = "";

    const allButton =
        document.createElement(
            "button"
        );

    allButton.type = "button";
    allButton.className = "filter-chip";
    allButton.dataset.category = "__all__";
    allButton.textContent = "Все";

    allButton.addEventListener(
        "click",
        () => {
            toggleFilterChip(allButton);
        }
    );

    container.appendChild(allButton);

    categories.forEach(
        ([key, label]) => {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";
            button.className = "filter-chip";
            button.dataset.category = label;
            button.textContent = label;

            button.addEventListener(
                "click",
                () => {
                    toggleFilterChip(button);
                }
            );

            container.appendChild(button);
        }
    );

    syncCategoryFilterUI();
}

/*
Синхронизация UI фильтров
с activeFilters.
*/

function syncFilterUI() {

    const queryInput =
        document.getElementById(
            "filterQuery"
        );

    if (queryInput) {
        queryInput.value = activeFilters.query || "";
    }

    const sortSelect = document.getElementById("filterSort");
    if (sortSelect) sortSelect.value = activeFilters.sort || "relevance";

    const minInput =
        document.getElementById(
            "filterMinPrice"
        );


    const maxInput =
        document.getElementById(
            "filterMaxPrice"
        );


    if (minInput) {

        minInput.value =
            activeFilters.minPrice !== null
                ? activeFilters.minPrice
                : "";
    }


    if (maxInput) {

        maxInput.value =
            activeFilters.maxPrice !== null
                ? activeFilters.maxPrice
                : "";
    }


    syncCategoryFilterUI();


    syncSourceFilterUI();


    updateFilterButton();
}


/*
Категории.
*/

function syncCategoryFilterUI() {

    const container =
        document.getElementById(
            "filterCategories"
        );


    if (!container) {
        return;
    }


    const buttons =
        container.querySelectorAll(
            ".filter-chip"
        );


    const selected =
        new Set(
            activeFilters.categories.map(
                category =>
                    getFilterCategoryKey(
                        category
                    )
            )
        );


    buttons.forEach(
        button => {

            const value =
                button.dataset.category;


            if (
                value === "__all__"
            ) {

                button.classList.toggle(
                    "active",
                    selected.size === 0
                );

                return;
            }


            button.classList.toggle(
                "active",
                selected.has(
                    getFilterCategoryKey(
                        value
                    )
                )
            );
        }
    );
}


/*
Источники.
*/

function syncSourceFilterUI() {

    const container =
        document.getElementById(
            "filterSources"
        );


    if (!container) {
        return;
    }


    const selected =
        new Set(
            activeFilters.sources.map(
                source =>
                    normalizeSource(
                        source
                    )
            )
        );


    const buttons =
        container.querySelectorAll(
            ".filter-chip"
        );


    buttons.forEach(
        button => {

            const value =
                button.dataset.source;


            if (
                value === "__all__"
            ) {

                button.classList.toggle(
                    "active",
                    selected.size === 0
                );

                return;
            }


            button.classList.toggle(
                "active",
                selected.has(
                    normalizeSource(
                        value
                    )
                )
            );
        }
    );
}


/*
Обновляем маленький индикатор
на кнопке фильтров, если он есть.
*/

function updateFilterButton() {

    const button =
        document.querySelector(
            ".top-filter"
        );


    if (!button) {
        return;
    }


    const count =
        getActiveFilterCount();


    button.classList.toggle(
        "active",
        count > 0
    );


    const existingBadge =
        button.querySelector(
            ".filter-badge"
        );


    if (existingBadge) {

        existingBadge.remove();
    }


    if (
        count > 0
    ) {

        const badge =
            document.createElement(
                "span"
            );


        badge.className =
            "filter-badge";


        badge.textContent =
            count;


        button.appendChild(
            badge
        );
    }
}


/*
Главная функция фильтрации.

Сначала фильтруем весь каталог,
после чего результат передаётся
в алгоритм рекомендаций.
*/

function applyProductFilters(
    source
) {

    const input =
        Array.isArray(source)
            ? source
            : [];


    const query =
        normalizeText(
            activeFilters.query || ""
        );


    const minPrice =
        activeFilters.minPrice !== null
            ? Number(
                activeFilters.minPrice
            )
            : null;


    const maxPrice =
        activeFilters.maxPrice !== null
            ? Number(
                activeFilters.maxPrice
            )
            : null;


    const categories =
        new Set(
            activeFilters.categories.map(
                category =>
                    normalizeText(
                        category
                    )
            )
        );


    const sources =
        new Set(
            activeFilters.sources.map(
                source =>
                    normalizeSource(
                        source
                    )
            )
        );


    const hasCategoryFilter =
        categories.size > 0;


    const hasSourceFilter =
        sources.size > 0;


    return input.filter(
        product => {

            if (!product) {
                return false;
            }


            /*
            Ключевой запрос.

            Ищем не только по названию, но и по бренду,
            категории, описанию и площадке.
            Для небольших опечаток используем тот же
            tolerant matching, что и в обычном поиске.
            */

            if (query) {

                const searchable = normalizeText([
                    product.title,
                    product.brand,
                    product.category,
                    product.description,
                    product.source,
                    product.sourceLabel
                ].filter(Boolean).join(" "));

                const queryTokens = query.split(/\s+/).filter(Boolean);

                const matches = queryTokens.every(token =>
                    searchable.includes(token) ||
                    searchTokenMatches(token, searchable)
                );

                if (!matches) {
                    return false;
                }
            }


            /*
            Цена.

            Товары без цены при активном
            ценовом фильтре не показываем,
            потому что невозможно понять,
            подходят они или нет.
            */

            if (
                minPrice !== null ||
                maxPrice !== null
            ) {

                if (
                    product.price === null ||
                    !Number.isFinite(
                        Number(
                            product.price
                        )
                    )
                ) {

                    return false;
                }


                const price =
                    Number(
                        product.price
                    );


                if (
                    minPrice !== null &&
                    price < minPrice
                ) {

                    return false;
                }


                if (
                    maxPrice !== null &&
                    price > maxPrice
                ) {

                    return false;
                }
            }


            /*
            Категория.
            */

            if (
                hasCategoryFilter
            ) {

                const category =
                    getFilterCategoryKey(
                        product.category
                    );


                if (
                    !categories.has(
                        category
                    )
                ) {

                    return false;
                }
            }


            /*
            Площадка.
            */

            if (
                hasSourceFilter
            ) {

                const sourceName =
                    normalizeSource(
                        product.source
                    );


                if (
                    !sources.has(
                        sourceName
                    )
                ) {

                    return false;
                }
            }


            return true;
        }
    );
}


/* =========================================================
FILTER SORTING
========================================================= */

function applyFeedSort(list, sortMode) {

    if (!Array.isArray(list)) return list;

    if (sortMode === "price_asc") {
        list.sort((a, b) => {
            const pa = parsePrice(a && a.price);
            const pb = parsePrice(b && b.price);
            const va = pa === null || !Number.isFinite(pa) ? Infinity : pa;
            const vb = pb === null || !Number.isFinite(pb) ? Infinity : pb;
            return va - vb;
        });
    } else if (sortMode === "price_desc") {
        list.sort((a, b) => {
            const pa = parsePrice(a && a.price);
            const pb = parsePrice(b && b.price);
            const va = pa === null || !Number.isFinite(pa) ? -Infinity : pa;
            const vb = pb === null || !Number.isFinite(pb) ? -Infinity : pb;
            return vb - va;
        });
    } else if (sortMode === "newest") {
        list.sort((a, b) => {
            const da = new Date((a && (a.created_at || a.updated_at)) || 0).getTime();
            const db = new Date((b && (b.created_at || b.updated_at)) || 0).getTime();
            return db - da;
        });
    }

    return list;
}

/* =========================================================
PERSONALIZED FEED
========================================================= */

function buildPersonalizedFeed() {

    if (!Array.isArray(allProducts) || !allProducts.length) {
        products = [];
        return;
    }

    /*
    Персональная лента работает только для общей ленты.
    Явный серверный поиск имеет отдельный режим и сюда не попадает.
    */
    if (activeServerSearch && String(activeServerSearch.query || '').trim()) {
        return;
    }

    const filteredProducts = applyProductFilters(allProducts);

    if (!filteredProducts.length) {
        products = [];
        return;
    }

    /*
    КЛЮЧЕВОЕ ПРАВИЛО:
    просмотренные товары никогда не попадают обратно
    в автоматические рекомендации.

    Исключение существует только для явного поиска, который
    обрабатывается через performSearch()/prepareServerSearchFeed().
    */
    const viewedSet = new Set(
        viewedProducts.map(id => String(id))
    );

    const candidates = filteredProducts.filter(product =>
        product && !viewedSet.has(String(product.id))
    );

    if (!candidates.length) {
        products = [];
        console.log('[StyleFlow] Все подходящие товары уже просмотрены.');
        return;
    }

    const profile = buildUserProfile();
    const personalization = getPersonalizationStrength(profile.totalSignals);

    console.log('[StyleFlow] Персональная лента:', {
        totalProducts: allProducts.length,
        candidates: candidates.length,
        viewed: viewedSet.size,
        signals: profile.totalSignals,
        personalization
    });

    /*
    До накопления истории не притворяемся, что знаем интересы пользователя.
    Делаем исследовательскую ленту, но уже без повторов.
    */
    if (personalization <= 0) {
        products = buildDiverseRandomFeed(shuffleArray(candidates));
        applyFeedSort(products, activeFilters.sort || 'relevance');
        return;
    }

    const scored = candidates.map(product => ({
        product,
        score: calculateRecommendationScore(product, profile)
    }));

    products = buildWeightedDiverseFeed(
        scored,
        personalization
    );

    applyFeedSort(products, activeFilters.sort || 'relevance');

    console.log('[StyleFlow] Рекомендации построены.');
}


/* =========================================================
PERSONALIZATION STRENGTH
========================================================= */

function getPersonalizationStrength(
    totalSignals
) {

    const signals =
        Number(totalSignals) || 0;


    if (
        signals <= PERSONALIZATION_START
    ) {

        return 0;
    }


    const progress =
        (
            signals -
            PERSONALIZATION_START
        ) /
        (
            PERSONALIZATION_FULL -
            PERSONALIZATION_START
        );


    return Math.max(
        0,
        Math.min(
            1,
            progress
        )
    );
}


/* =========================================================
RANDOM FEED WITH DIVERSITY
========================================================= */

function buildDiverseRandomFeed(
    source
) {

    const remaining =
        [
            ...source
        ];


    const result = [];


    let lastCategory =
        null;

    let lastSource =
        null;

    let categoryStreak =
        0;

    let sourceStreak =
        0;


    while (
        remaining.length
    ) {

        let available =
            remaining.filter(
                product => {

                    const category =
                        normalizeText(
                            product.category
                        );


                    const source =
                        normalizeText(
                            product.source
                        );


                    const categoryBlocked =
                        category &&
                        category ===
                            lastCategory &&
                        categoryStreak >=
                            MAX_SAME_CATEGORY_STREAK;


                    const sourceBlocked =
                        source &&
                        source ===
                            lastSource &&
                        sourceStreak >=
                            MAX_SAME_SOURCE_STREAK;


                    return !(
                        categoryBlocked ||
                        sourceBlocked
                    );
                }
            );


        if (
            !available.length
        ) {

            available =
                remaining;
        }


        const randomIndex =
            Math.floor(
                Math.random() *
                available.length
            );


        const selected =
            available[randomIndex];


        const originalIndex =
            remaining.indexOf(
                selected
            );


        if (
            originalIndex >= 0
        ) {

            remaining.splice(
                originalIndex,
                1
            );
        }


        const category =
            normalizeText(
                selected.category
            );


        const sourceName =
            normalizeText(
                selected.source
            );


        if (
            category ===
            lastCategory
        ) {

            categoryStreak++;

        } else {

            lastCategory =
                category;

            categoryStreak =
                1;
        }


        if (
            sourceName ===
            lastSource
        ) {

            sourceStreak++;

        } else {

            lastSource =
                sourceName;

            sourceStreak =
                1;
        }


        result.push(
            selected
        );
    }


    return result;
}


/* =========================================================
WEIGHTED DIVERSE FEED
========================================================= */

function buildWeightedDiverseFeed(
    scoredProducts,
    personalization
) {

    const remaining =
        scoredProducts.map(
            item => ({
                ...item
            })
        );


    const result = [];


    let lastCategory =
        null;

    let lastSource =
        null;

    let categoryStreak =
        0;

    let sourceStreak =
        0;


    const randomRatio =
        MAX_RANDOM_RATIO -
        (
            MAX_RANDOM_RATIO -
            MIN_RANDOM_RATIO
        ) *
        Math.max(0, Math.min(1, personalization));


    while (
        remaining.length
    ) {

        let available =
            remaining.filter(
                item => {

                    const product =
                        item.product;


                    const category =
                        normalizeText(
                            product.category
                        );


                    const source =
                        normalizeText(
                            product.source
                        );


                    const categoryBlocked =
                        category &&
                        category ===
                            lastCategory &&
                        categoryStreak >=
                            MAX_SAME_CATEGORY_STREAK;


                    const sourceBlocked =
                        source &&
                        source ===
                            lastSource &&
                        sourceStreak >=
                            MAX_SAME_SOURCE_STREAK;


                    return !(
                        categoryBlocked ||
                        sourceBlocked
                    );
                }
            );


        if (
            !available.length
        ) {

            available =
                remaining;
        }


        let selected;


        const useRandom =
            Math.random() <
            randomRatio;


        if (
            useRandom
        ) {

            const randomIndex =
                Math.floor(
                    Math.random() *
                    available.length
                );


            selected =
                available[randomIndex];

        } else {

            selected =
                weightedRandomScoreChoice(
                    available
                );
        }


        const originalIndex =
            remaining.indexOf(
                selected
            );


        if (
            originalIndex >= 0
        ) {

            remaining.splice(
                originalIndex,
                1
            );
        }


        const category =
            normalizeText(
                selected.product.category
            );


        const source =
            normalizeText(
                selected.product.source
            );


        if (
            category ===
            lastCategory
        ) {

            categoryStreak++;

        } else {

            lastCategory =
                category;

            categoryStreak =
                1;
        }


        if (
            source ===
            lastSource
        ) {

            sourceStreak++;

        } else {

            lastSource =
                source;

            sourceStreak =
                1;
        }


        result.push(
            selected.product
        );
    }


    return result;
}


/* =========================================================
WEIGHTED SCORE CHOICE
========================================================= */

function weightedRandomScoreChoice(
    items
) {

    if (
        !items.length
    ) {

        return null;
    }


    let maxScore =
        0;


    items.forEach(
        item => {

            if (
                item.score > maxScore
            ) {

                maxScore =
                    item.score;
            }
        }
    );


    let totalWeight =
        0;


    const weighted =
        items.map(
            item => {

                const normalized =
                    maxScore > 0
                        ? item.score /
                          maxScore
                        : 0;


                const weight =
                    0.15 +
                    Math.pow(
                        Math.max(
                            0,
                            normalized
                        ),
                        2
                    ) *
                    10;


                totalWeight +=
                    weight;


                return {
                    item,
                    weight
                };
            }
        );


    let random =
        Math.random() *
        totalWeight;


    for (
        const entry of weighted
    ) {

        random -=
            entry.weight;


        if (
            random <= 0
        ) {

            return entry.item;
        }
    }


    return weighted[
        weighted.length - 1
    ].item;
}


/* =========================================================
USER PROFILE
========================================================= */

function buildUserProfile() {

    const profile = {
        categories: {},
        brands: {},
        sources: {},
        keywords: {},
        prices: [],
        totalSignals: 0
    };

    /*
    Просмотр — слабый сигнал.
    Более свежие действия имеют больший вес.
    */
    const viewed = Array.isArray(viewedProducts)
        ? viewedProducts.slice(-200)
        : [];

    viewed.forEach((id, index) => {
        const product = findProductById(id);
        if (!product) return;

        const recency = 0.55 + (index + 1) / viewed.length * 0.45;
        addProfileSignal(profile, product, 0.8 * recency);
    });

    /*
    Открытие карточки — значительно более сильный сигнал.
    */
    const opened = Array.isArray(openedProducts)
        ? openedProducts.slice(-120)
        : [];

    opened.forEach((id, index) => {
        const product = findProductById(id);
        if (!product) return;

        const recency = 0.60 + (index + 1) / opened.length * 0.40;
        addProfileSignal(profile, product, 4.0 * recency);
    });

    /*
    Избранное — самый сильный явный сигнал интереса.
    */
    favorites.forEach(item => {
        const product = normalizeProduct(item);
        addProfileSignal(profile, product, 8);
    });

    /*
    Поиск — сильный сигнал намерения.
    Последние запросы важнее старых.
    */
    const searchHistory = loadJSON(
        'styleflow_search_history',
        []
    );

    if (Array.isArray(searchHistory)) {
        const recentSearches = searchHistory.slice(-40);

        recentSearches.forEach((entry, index) => {
            const query = typeof entry === 'string'
                ? entry
                : entry && entry.query;

            if (!query) return;

            const recency = 0.60 + (index + 1) / recentSearches.length * 0.40;

            tokenizeForRecommendations(query).forEach(token => {
                profile.keywords[token] =
                    (profile.keywords[token] || 0) + 5 * recency;

                profile.totalSignals += 5 * recency;
            });
        });
    }

    return profile;
}

function tokenizeForRecommendations(value) {
    return normalizeText(value)
        .split(/[^a-zа-яё0-9]+/i)
        .map(word => word.trim())
        .filter(word => word.length >= 2)
        .filter(word => ![
            "для", "это", "как", "или", "и", "на", "по", "до",
            "из", "в", "с", "купить", "найти", "товар", "товары"
        ].includes(word));
}

/* =========================================================
PROFILE SIGNAL
========================================================= */

function addProfileSignal(
    profile,
    product,
    weight
) {

    if (!product) {
        return;
    }


    const category =
        normalizeText(
            product.category
        );


    if (category) {

        profile.categories[
            category
        ] =
            (
                profile.categories[
                    category
                ] || 0
            ) +
            weight;
    }


    const brand =
        normalizeText(
            product.brand
        );


    if (brand) {

        profile.brands[
            brand
        ] =
            (
                profile.brands[
                    brand
                ] || 0
            ) +
            weight;
    }


    const searchableText = [
        product.title,
        product.brand,
        product.category,
        product.description
    ].filter(Boolean).join(" ");

    tokenizeForRecommendations(searchableText).forEach(token => {
        profile.keywords[token] =
            (profile.keywords[token] || 0) + Math.max(1, Math.round(weight / 2));
    });


    const source =
        normalizeText(
            product.source
        );


    if (source) {

        profile.sources[
            source
        ] =
            (
                profile.sources[
                    source
                ] || 0
            ) +
            weight;
    }


    if (
        product.price !== null &&
        Number.isFinite(
            Number(product.price)
        )
    ) {

        profile.prices.push({

            price:
                Number(
                    product.price
                ),

            weight
        });
    }


    profile.totalSignals +=
        weight;
}


/* =========================================================
RECOMMENDATION SCORE
========================================================= */

function calculateRecommendationScore(
    product,
    profile
) {

    if (!product || !profile) {
        return 0;
    }

    let score = 0;

    const searchable = normalizeText([
        product.title,
        product.brand,
        product.category,
        product.description
    ].filter(Boolean).join(' '));

    /* Совпадение с тем, что пользователь реально ищет. */
    tokenizeForRecommendations(searchable).forEach(token => {
        const weight = profile.keywords[token];
        if (weight) {
            score += weight * 2.4;
        }
    });

    const category = normalizeText(product.category);
    if (category && profile.categories[category]) {
        score += profile.categories[category] * 6;
    }

    const brand = normalizeText(product.brand);
    if (brand && profile.brands[brand]) {
        score += profile.brands[brand] * 9;
    }

    const source = normalizeText(product.source);
    if (source && profile.sources[source]) {
        score += profile.sources[source] * 1.5;
    }

    /* Близость цены к привычному диапазону пользователя. */
    if (
        product.price !== null &&
        Number.isFinite(Number(product.price)) &&
        profile.prices.length
    ) {
        const averagePrice = getWeightedAveragePrice(profile.prices);

        if (averagePrice > 0) {
            const difference = Math.abs(
                Number(product.price) - averagePrice
            );

            const percentage = difference / averagePrice;

            if (percentage <= 0.10) {
                score += 14;
            } else if (percentage <= 0.25) {
                score += 8;
            } else if (percentage <= 0.50) {
                score += 3;
            }
        }
    }

    /* Небольшой бонус новым карточкам, чтобы лента не застывала. */
    const dateValue = new Date(
        product.updated_at || product.created_at || 0
    ).getTime();

    if (Number.isFinite(dateValue) && dateValue > 0) {
        const ageDays = Math.max(
            0,
            (Date.now() - dateValue) / 86400000
        );

        if (ageDays <= 1) {
            score += 2;
        } else if (ageDays <= 7) {
            score += 1;
        }
    }

    /*
    Очень маленькая случайность только для равных/похожих кандидатов.
    Она не способна перебить сильный интерес пользователя.
    */
    score += Math.random() * 0.8;

    return Math.max(0, score);
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

function normalizeText(
    value
) {

    return String(
        value || ""
    )
        .toLowerCase()
        .trim();
}


function findProductById(
    id
) {

    const target =
        String(id);


    return allProducts.find(
        product =>
            String(
                product.id
            ) ===
            target
    );
}


function shuffleArray(
    array
) {

    const result =
        [
            ...array
        ];


    for (
        let i =
            result.length - 1;
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


function uniqueStrings(
    values
) {

    const result = [];

    const seen =
        new Set();


    (Array.isArray(values)
        ? values
        : []
    ).forEach(
        value => {

            const normalized =
                String(
                    value
                ).trim();


            const key =
                normalizeText(
                    normalized
                );


            if (
                !key ||
                seen.has(key)
            ) {

                return;
            }


            seen.add(
                key
            );


            result.push(
                normalized
            );
        }
    );


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
        String(
            product.id
        );


    return viewedProducts.some(
        viewedId =>
            String(
                viewedId
            ) ===
            id
    );
}


function findNextUnviewedIndex(
    startIndex,
    direction
) {

    if (
        !products.length
    ) {

        return -1;
    }


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
            index >=
            products.length
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

function showProduct(allowViewed = false) {

    if (
        !products.length
    ) {

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
        currentIndex >=
        products.length
    ) {

        currentIndex = 0;
    }


    currentProduct =
        products[
            currentIndex
        ];

    preloadUpcomingImages();


    if (
        !allowViewed &&
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
            products[
                currentIndex
            ];
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
        "";


    updateLikeButton();


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

function switchTab(
    tab
) {

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

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.classList.remove(
                    "active"
                );
            }
        }
    );


    const targetScreen =
        document.getElementById(
            screens[tab]
        );


    if (targetScreen) {

        targetScreen.classList.add(
            "active"
        );
    }


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

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.classList.remove(
                    "active"
                );
            }
        }
    );


    const targetNav =
        document.getElementById(
            navs[tab]
        );


    if (targetNav) {

        targetNav.classList.add(
            "active"
        );
    }


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

                const input =
                    document.getElementById(
                        "searchInput"
                    );


                if (input) {

                    input.focus();
                }

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
                String(
                    currentProduct.id
                )
        );


    let favoriteAction = "remove";

    if (
        index >= 0
    ) {

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

        favoriteAction = "add";

        showToast(
            "❤️ Добавлено в избранное"
        );


        showHeart();
    }


    saveJSON(
        "styleflow_favorites",
        favorites
    );

    void syncFavoriteToServer(
        currentProduct,
        favoriteAction
    );


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


    if (
        !button ||
        !currentProduct
    ) {

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
            ? String(
                currentProduct.id
            )
            : null;


    buildPersonalizedFeed();


    if (
        currentId
    ) {

        products =
            products.filter(
                product =>
                    String(
                        product.id
                    ) !==
                    currentId
            );
    }


    currentIndex = 0;


    if (
        !products.length
    ) {

        showEmptyFeed();

        return;
    }
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


    if (!grid || !empty) {
        return;
    }


    grid.innerHTML = "";


    if (
        !favorites.length
    ) {

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
                        ${escapeHTML(
                            formatPrice(product)
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


    if (
        index >= 0
    ) {

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


    const image =
        document.getElementById(
            "productImage"
        );


    if (image) {

        image.src =
            product.image;
    }


    const title =
        document.getElementById(
            "productTitle"
        );


    if (title) {

        title.textContent =
            product.title;
    }


    const brand =
        document.getElementById(
            "productBrand"
        );


    if (brand) {

        brand.textContent =
            product.brand ||
            "StyleFlow";
    }


    const source =
        document.getElementById(
            "productSource"
        );


    if (source) {

        source.textContent =
            sourceLabel(
                product.source
            );
    }


    const price =
        document.getElementById(
            "productPrice"
        );


    if (price) {

        price.textContent =
            formatPrice(
                product
            );
    }


    const oldPrice =
        document.getElementById(
            "productOldPrice"
        );


    if (oldPrice) {

        oldPrice.textContent =
            product.oldPrice
                ? formatPrice({

                    price:
                        product.oldPrice,

                    currency:
                        product.currency
                })
                : "";
    }


    const rating =
        document.getElementById(
            "productRating"
        );


    if (rating) {

        rating.textContent =
            product.rating
                ? "★ " +
                  product.rating
                : "★ —";
    }


    const category =
        document.getElementById(
            "productCategory"
        );


    if (category) {

        category.textContent =
            product.category ||
            "";
    }


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

        if (
            navigator.share
        ) {

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


    if (!overlay || !list) {
        return;
    }


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
                            ${escapeHTML(
                                comment.user
                            )}
                        </div>

                        <div class="comment-text">
                            ${escapeHTML(
                                comment.text
                            )}
                        </div>

                    </div>

                `
            )
            .join("");


    overlay.classList.add(
        "show"
    );
}


function closeComments(
    event
) {

    if (
        !event ||
        event.target.id ===
            "commentsOverlay"
    ) {

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

            renderSearchSuggestions(value);


            const clearButton =
                document.getElementById(
                    "searchClear"
                );


            if (clearButton) {

                clearButton.style.display =
                    value
                        ? "flex"
                        : "none";
            }


            // Пока пользователь печатает, только обновляем подсказки.
            // Поиск товаров запускается только после Enter или выбора подсказки.
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


                hideSearchSuggestions();
                const enteredQuery = input.value.trim();
                performSearch(
                    enteredQuery
                );
            }
        }
    );
}


function quickSearch(
    query
) {

    switchTab(
        "search"
    );


    const input =
        document.getElementById(
            "searchInput"
        );


    if (!input) {
        return;
    }


    input.value =
        query;


    const clearButton =
        document.getElementById(
            "searchClear"
        );


    if (clearButton) {

        clearButton.style.display =
            "flex";
    }


    performSearch(
        query
    );
}


function clearSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );


    if (!input) {
        return;
    }


    input.value = "";
    hideSearchSuggestions();

    /*
    Полностью завершаем предыдущую поисковую сессию.
    Иначе после очистки интерфейса старый запрос мог продолжать
    считаться активным для свайпа/догрузки.
    */
    activeServerSearch = {
        query: "",
        sources: [],
        minPrice: null,
        maxPrice: null
    };

    serverSearchHasMore = true;
    serverSearchLoading = false;
    serverSearchRequestId++;

    products = [];
    currentIndex = 0;
    currentProduct = null;
    resetNavigationHistory();


    const clearButton =
        document.getElementById(
            "searchClear"
        );


    if (clearButton) {

        clearButton.style.display =
            "none";
    }


    const results =
        document.getElementById(
            "searchResults"
        );


    if (results) {

        results.classList.remove(
            "active"
        );
    }


    const home =
        document.getElementById(
            "searchHome"
        );


    if (home) {

        home.style.display =
            "block";
    }


    input.focus();
}


let activeSearchSources = loadJSON(
    "styleflow_search_sources",
    []
);

if (!Array.isArray(activeSearchSources)) {
    activeSearchSources = [];
}

function normalizeSearchSource(value) {
    return String(value || "").trim().toLowerCase();
}

function setupSearchSources() {
    const container = document.getElementById("searchSources");
    if (!container) return;

    container.querySelectorAll("[data-source]").forEach(button => {
        button.addEventListener("click", () => {
            const source = normalizeSearchSource(button.dataset.source);

            if (source === "__all__") {
                activeSearchSources = [];
            } else {
                const index = activeSearchSources.indexOf(source);
                if (index >= 0) activeSearchSources.splice(index, 1);
                else activeSearchSources.push(source);
            }

            saveJSON("styleflow_search_sources", activeSearchSources);
            syncSearchSourceUI();

            const input = document.getElementById("searchInput");
            const query = input ? input.value.trim() : "";
            if (query) performSearch(query);
        });
    });

    syncSearchSourceUI();
}

function syncSearchSourceUI() {
    const container = document.getElementById("searchSources");
    if (!container) return;

    container.querySelectorAll("[data-source]").forEach(button => {
        const raw = normalizeSearchSource(button.dataset.source);
        const active = raw === "__all__"
            ? activeSearchSources.length === 0
            : activeSearchSources.includes(raw);
        button.classList.toggle("active", active);
    });
}

function levenshteinDistance(a, b) {
    a = String(a || "");
    b = String(b || "");
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const temp = row[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
            prev = temp;
        }
    }
    return row[b.length];
}

function searchWordMatches(queryWord, textWord) {
    const query = normalizeText(queryWord);
    const text = normalizeText(textWord);

    if (!query || !text) return false;
    if (query === text) return true;

    // Прямое вхождение — главное правило поиска.
    if (text.includes(query) || query.includes(text)) return true;

    // Нечёткое совпадение используем только для достаточно длинных слов.
    // Это не позволяет коротким/случайным словам давать ложные совпадения.
    if (query.length < 4 || text.length < 4) return false;

    const lengthDiff = Math.abs(query.length - text.length);
    if (lengthDiff > 2) return false;

    const distance = levenshteinDistance(query, text);
    const maxLen = Math.max(query.length, text.length);

    let allowed = 1;
    if (maxLen >= 8) allowed = 2;
    if (maxLen >= 12) allowed = 2;

    // Для длинного слова две ошибки допустимы только если
    // совпадает хотя бы половина символов.
    return distance <= allowed && (1 - distance / maxLen) >= 0.55;
}

function searchTokenMatches(token, searchable) {
    const query = normalizeText(token);
    const text = normalizeText(searchable);
    if (!query || !text) return false;

    const words = text.split(/[^a-zа-яё0-9]+/i).filter(Boolean);

    // Сначала ищем точное слово/фрагмент.
    if (words.some(word => word === query || word.includes(query) || query.includes(word))) {
        return true;
    }

    // И только потом допускаем небольшую опечатку.
    if (words.some(word => searchWordMatches(query, word))) return true;

    const aliases = {
        "айфон": ["iphone"],
        "iphone": ["айфон"],
        "самсунг": ["samsung"],
        "samsung": ["самсунг"],
        "ксяоми": ["xiaomi"],
        "сяоми": ["xiaomi"],
        "ноут": ["ноутбук"],
        "смартфон": ["телефон"],
        "телефон": ["смартфон"],
        "авто": ["автомобиль", "машина"],
        "машина": ["авто", "автомобиль"],
        "тачка": ["авто", "машина"]
    };

    return (aliases[query] || []).some(alias =>
        words.some(word => word === alias || word.includes(alias) || alias.includes(word))
    );
}


const UNIVERSAL_SEARCH_SUGGESTIONS = [
    ["🚗", "машина", "автомобили"],
    ["🚗", "автомобиль", "автомобили"],
    ["🚗", "bmw", "автомобили"],
    ["🚗", "mercedes", "автомобили"],
    ["🚗", "audi", "автомобили"],
    ["🏠", "квартира", "недвижимость"],
    ["🏠", "дом", "недвижимость"],
    ["🏠", "недвижимость", "недвижимость"],
    ["💻", "ноутбук", "электроника"],
    ["💻", "компьютер", "электроника"],
    ["💻", "пк", "электроника"],
    ["📱", "телефон", "электроника"],
    ["📱", "iphone", "электроника"],
    ["📱", "айфон", "электроника"],
    ["📱", "samsung", "электроника"],
    ["🔧", "ремонт", "услуги"],
    ["🔧", "ремонт телефона", "услуги"],
    ["🔧", "ремонт ноутбука", "услуги"],
    ["🔧", "ремонт автомобиля", "услуги"],
    ["🛠️", "строительство", "услуги"],
    ["🪑", "мебель", "товары"],
    ["🎮", "игровой компьютер", "электроника"],
    ["🎧", "наушники", "электроника"],
    ["📷", "камера", "электроника"],
    ["⚙️", "запчасти", "автомобили"]
];

function rememberSearchQuery(query) {
    const normalized = normalizeText(query);
    if (!normalized || normalized.length < 2) return;

    let history = loadJSON("styleflow_search_history", []);
    if (!Array.isArray(history)) history = [];

    history.push({
        query: normalized,
        created_at: Date.now()
    });

    if (history.length > 100) {
        history = history.slice(-100);
    }

    saveJSON("styleflow_search_history", history);
}

function buildDynamicSearchSuggestions(query) {
    const normalized = normalizeText(query);
    if (!normalized) return [];

    const result = [];
    const used = new Set();

    function add(icon, text, meta, score) {
        const key = normalizeText(text);
        if (!key || used.has(key)) return;
        used.add(key);
        result.push({ icon, text, meta, score });
    }

    UNIVERSAL_SEARCH_SUGGESTIONS.forEach(([icon, text, meta]) => {
        const n = normalizeText(text);
        let score = 0;

        if (n === normalized) score = 100;
        else if (n.startsWith(normalized)) score = 85;
        else if (n.includes(normalized)) score = 70;
        else if (searchTokenMatches(normalized, n)) score = 55;

        if (score) add(icon, text, meta, score);
    });

    const queryTokens = normalized.split(/\s+/).filter(Boolean);

    allProducts.forEach(product => {
        const candidates = [
            product.title,
            product.brand,
            product.category
        ].filter(Boolean);

        candidates.forEach(candidate => {
            const clean = String(candidate).trim();
            const candidateNormalized = normalizeText(clean);

            if (!candidateNormalized || candidateNormalized.length < 2) return;

            let score = 0;
            if (candidateNormalized.startsWith(normalized)) score = 80;
            else if (candidateNormalized.includes(normalized)) score = 65;
            else if (queryTokens.some(token =>
                searchTokenMatches(token, candidateNormalized)
            )) score = 50;

            if (score) {
                add(
                    sourceIcon(product.source),
                    clean,
                    sourceLabel(product.source),
                    score
                );
            }
        });
    });

    const history = loadJSON("styleflow_search_history", []);
    if (Array.isArray(history)) {
        history.slice().reverse().forEach(entry => {
            const text = typeof entry === "string" ? entry : entry.query;
            if (!text) return;

            const n = normalizeText(text);
            let score = 0;

            if (n.startsWith(normalized)) score = 90;
            else if (n.includes(normalized)) score = 72;
            else if (searchTokenMatches(normalized, n)) score = 55;

            if (score) add("🕘", text, "твой прошлый поиск", score);
        });
    }

    return result
        .sort((a, b) => b.score - a.score)
        .slice(0, 7);
}

function renderSearchSuggestions(query) {
    const box = document.getElementById("searchSuggestions");
    if (!box) return;

    const normalized = normalizeText(query);

    if (!normalized) {
        box.classList.remove("active");
        box.innerHTML = "";
        return;
    }

    const suggestions = buildDynamicSearchSuggestions(query);

    if (!suggestions.length) {
        box.classList.remove("active");
        box.innerHTML = "";
        return;
    }

    box.innerHTML = suggestions.map((item, index) => `
        <button type="button" class="search-suggestion" onclick="selectSearchSuggestion(${index})">
            <span class="search-suggestion-icon">${escapeHTML(item.icon)}</span>
            <span class="search-suggestion-main">
                <span class="search-suggestion-title">${escapeHTML(item.text)}</span>
                <span class="search-suggestion-meta">${escapeHTML(item.meta)}</span>
            </span>
            <span class="search-suggestion-hint">›</span>
        </button>
    `).join("");

    box._suggestions = suggestions;
    box.classList.add("active");
}

async function selectSearchSuggestion(index) {
    const box = document.getElementById("searchSuggestions");
    const input = document.getElementById("searchInput");
    if (!box || !input || !box._suggestions) return;

    const item = box._suggestions[index];
    if (!item) return;

    // Подсказка должна стать именно поисковым запросом.
    // Раньше здесь запускался поиск без явной фиксации выбранного
    // значения, из-за чего в некоторых сценариях в ленту попадал
    // предыдущий каталог.
    const selectedQuery = String(item.text || "").trim();
    if (!selectedQuery) return;

    input.value = selectedQuery;

    const clearButton = document.getElementById("searchClear");
    if (clearButton) clearButton.style.display = "flex";

    box.classList.remove("active");
    box.innerHTML = "";
    box._suggestions = [];

    // Сохраняем именно выбранную подсказку как запрос пользователя.
    rememberSearchQuery(selectedQuery);

    // Передаём запрос напрямую в серверный поиск и не используем
    // старое значение фильтра/предыдущего поиска.
    await performSearch(selectedQuery, {
        sources: Array.isArray(activeSearchSources)
            ? activeSearchSources.slice()
            : [],
        minPrice: null,
        maxPrice: null
    });
}


let searchSuggestionsFocusFix = false;

function setupSearchSuggestionFocus() {
    const input = document.getElementById("searchInput");
    const box = document.getElementById("searchSuggestions");
    if (!input || !box || searchSuggestionsFocusFix) return;

    searchSuggestionsFocusFix = true;

    input.addEventListener("focus", () => {
        const value = input.value.trim();
        if (value) renderSearchSuggestions(value);
    });

    input.addEventListener("blur", () => {
        setTimeout(() => {
            if (!box.matches(":hover") &&
                document.activeElement !== input) {
                box.classList.remove("active");
            }
        }, 180);
    });

    box.addEventListener("mousedown", (event) => {
        event.preventDefault();
    });
}

function hideSearchSuggestions() {
    const box = document.getElementById("searchSuggestions");
    if (box) box.classList.remove("active");
}

async function isBlockedSearchQueryLocal(query) {
    const text = normalizeText(query || "").replace(/\s+/g, "");
    if (!text) return false;

    const blocked = [
        "хуй", "хуя", "хуе", "хуйн", "хует",
        "пизд", "еб", "еба", "ебл", "ебан",
        "бля", "бляд", "сука", "шлюх",
        "дилдо", "вибратор", "порно", "порн", "секс",
        "porn", "fuck", "dildo", "xxx"
    ];

    return blocked.some(term => text.includes(term));
}


async function performSearch(query, searchOptions = null) {
    const home = document.getElementById("searchHome");
    const results = document.getElementById("searchResults");
    const resultList = document.getElementById("resultList");
    const resultCount = document.getElementById("resultCount");

    if (!home || !results || !resultList || !resultCount) {
        return;
    }

    query = String(query || "").trim();

    if (!query) {
        /*
        Пустой запрос полностью выключает режим серверного поиска.
        */
        activeServerSearch = {
            query: "",
            sources: [],
            minPrice: null,
            maxPrice: null
        };

        serverSearchHasMore = true;
        serverSearchRequestId++;

        products = [];
        currentIndex = 0;
        currentProduct = null;
        resetNavigationHistory();

        home.style.display = "block";
        results.classList.remove("active");
        hideSearchSuggestions();

        return;
    }

    /*
    Новый запрос = новая сессия поиска.

    Сначала полностью убираем старую поисковую ленту.
    Это принципиально важно: пока сервер ищет "колодки",
    старые "наушники" больше не должны оставаться видимыми.
    */
    const requestId = ++serverSearchRequestId;

    const searchSources =
        searchOptions && Array.isArray(searchOptions.sources)
            ? searchOptions.sources.slice()
            : (
                Array.isArray(activeSearchSources)
                    ? activeSearchSources.slice()
                    : []
            );

    activeServerSearch = {
        query,
        sources: searchSources,
        minPrice:
            searchOptions && searchOptions.minPrice !== undefined
                ? searchOptions.minPrice
                : null,
        maxPrice:
            searchOptions && searchOptions.maxPrice !== undefined
                ? searchOptions.maxPrice
                : null
    };

    serverSearchHasMore = true;
    serverSearchLoading = true;

    /*
    Очищаем текущую карточку ДО fetch().
    Поэтому пользователь никогда не увидит старую ленту
    в качестве "загрузки" нового поиска.
    */
    products = [];
    currentIndex = 0;
    currentProduct = null;
    resetNavigationHistory();

    /*
    Во время ожидания остаёмся на экране поиска.
    В ленту переключаемся только после получения актуальных
    результатов именно этого запроса.
    */
    switchTab("search");

    home.style.display = "none";
    results.classList.add("active");
    hideSearchSuggestions();

    rememberSearchQuery(query.toLowerCase());

    if (typeof updateProfileInterests === "function") {
        updateProfileInterests();
    }

    resultCount.textContent = "Ищем товары...";
    resultList.innerHTML = `
        <div class="search-no-results">
            🔎 Ищем <b>${escapeHTML(query)}</b>...<br>
            <span>Проверяем нашу базу и при необходимости запрашиваем площадку.</span>
        </div>
    `;

    try {
        const data = await fetchServerSearch(false);

        /*
        Пока запрос выполнялся, пользователь мог ввести другой запрос.
        Старый ответ в таком случае полностью игнорируем.
        */
        if (requestId !== serverSearchRequestId) {
            return;
        }

        const incoming = Array.isArray(data.products)
            ? data.products.map(normalizeProduct)
            : [];

        /*
        Добавляем найденные товары в общий каталог для будущих запросов,
        но текущую ленту строим НЕ из allProducts, а только из incoming.
        */
        mergeProductsIntoCatalog(incoming);

        renderServerSearchResults(incoming, data);

        if (!incoming.length) {
            /*
            Ничего не нашли — остаёмся на экране поиска.
            В пустую/рандомную общую ленту не переходим.
            */
            products = [];
            currentIndex = 0;
            currentProduct = null;
            showEmptyFeed();
            return;
        }

        const prepared = prepareServerSearchFeed(incoming);

        if (!prepared) {
            products = [];
            currentIndex = 0;
            currentProduct = null;
            return;
        }

    } catch (error) {
        console.error("[StyleFlow] Server search error:", error);

        /*
        Если это уже неактуальный запрос, его ошибка тоже ничего
        не должна менять на экране.
        */
        if (requestId !== serverSearchRequestId) {
            return;
        }

        /*
        Локальный fallback тоже строит отдельную поисковую ленту,
        а не запускает общую персональную ленту.
        */
        const localResults = localSearchFallback(query);

        renderSearchResultList(
            localResults,
            localResults.length,
            true
        );

        if (localResults.length) {
            const prepared = prepareServerSearchFeed(localResults);

            if (!prepared) {
                products = [];
                currentIndex = 0;
                currentProduct = null;
            }
        } else {
            resultList.innerHTML = `
                <div class="search-no-results">
                    Не удалось найти <b>${escapeHTML(query)}</b>.<br>
                    <span>Проверь соединение с сервером и попробуй ещё раз.</span>
                </div>
            `;
        }

    } finally {
        if (requestId === serverSearchRequestId) {
            serverSearchLoading = false;
            serverSearchLastFetchAt = Date.now();
        }
    }
}


function buildServerSearchUrl(more = false) {
    const endpoint = more ? "/api/search/more" : "/api/search";
    const params = new URLSearchParams();

    params.set("query", activeServerSearch.query || "");
    params.set("limit", "100");
    if (activeServerSearch.sources && activeServerSearch.sources.length) {
        params.set("sources", activeServerSearch.sources.join(","));
    }

    if (activeServerSearch.minPrice !== null && activeServerSearch.minPrice !== undefined) {
        params.set("min_price", String(activeServerSearch.minPrice));
    }

    if (activeServerSearch.maxPrice !== null && activeServerSearch.maxPrice !== undefined) {
        params.set("max_price", String(activeServerSearch.maxPrice));
    }

    return `${endpoint}?${params.toString()}`;
}


async function fetchServerSearch(more = false) {
    const response = await fetch(
        buildServerSearchUrl(more),
        { cache: "no-store" }
    );

    if (!response.ok) {
        throw new Error(`Search request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "error") {
        throw new Error(data.message || "Server search error");
    }

    return data;
}


function mergeProductsIntoCatalog(incoming) {
    if (!Array.isArray(incoming) || !incoming.length) return;

    const map = new Map();

    allProducts.forEach(product => {
        if (product) map.set(String(product.id), product);
    });

    incoming.forEach(product => {
        if (product) map.set(String(product.id), product);
    });

    allProducts = Array.from(map.values());

    localStorage.setItem(
        "styleflow_main_feed",
        JSON.stringify(allProducts)
    );

    populateFilterCategories();
    renderFilterSources();
}


function renderServerSearchResults(incoming, data) {
    const resultList = document.getElementById("resultList");
    const resultCount = document.getElementById("resultCount");
    if (!resultList || !resultCount) return;

    const items = Array.isArray(incoming) ? incoming : [];

    if (!items.length) {
        resultCount.textContent = "Ничего не найдено";
        resultList.innerHTML = `
            <div class="search-no-results">
                Ничего точного не нашли.<br>
                <span>Попробуй изменить запрос или выбрать другую площадку.</span>
            </div>
        `;
        return;
    }

    const fetched = Number(data && data.fetched || 0);
    resultCount.textContent = fetched > 0
        ? `Найдено: ${items.length} · добавлено в общую базу`
        : `Найдено в базе: ${items.length}`;

    renderSearchResultList(items, items.length, false);
}


function renderSearchResultList(items, count, fallback = false) {
    const resultList = document.getElementById("resultList");
    const resultCount = document.getElementById("resultCount");
    if (!resultList || !resultCount) return;

    const list = Array.isArray(items) ? items : [];

    resultCount.textContent = fallback
        ? `Найдено локально: ${count}`
        : (count === 1 ? "Найден 1 товар" : `Найдено товаров: ${count}`);

    resultList.innerHTML = "";

    list.forEach(product => {
        const card = document.createElement("div");
        card.className = "search-result-card";
        card.innerHTML = `
            <img
                src="${escapeAttribute(product.image)}"
                alt="${escapeAttribute(product.title)}"
            >
            <div class="search-result-info">
                <div class="search-result-source">
                    ${escapeHTML(sourceLabel(product.source))}
                </div>
                <div class="search-result-title">
                    ${escapeHTML(product.title)}
                </div>
                <div class="search-result-price">
                    ${escapeHTML(formatPrice(product))}
                </div>
            </div>
        `;

        card.onclick = () => openProductFromObject(product);
        resultList.appendChild(card);
    });

    if (!list.length) {
        resultList.innerHTML = `
            <div class="search-no-results">
                Ничего не найдено.<br>
                <span>Попробуй другой запрос.</span>
            </div>
        `;
    }
}


function localSearchFallback(query) {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean);

    return allProducts.filter(product => {
        const searchable = [
            product.title,
            product.brand,
            product.category,
            product.description,
            product.source,
            sourceLabel(product.source)
        ].join(" ").toLowerCase();

        if (!tokens.every(token => searchTokenMatches(token, searchable))) {
            return false;
        }

        if (activeSearchSources.length) {
            return activeSearchSources.includes(
                normalizeSearchSource(product.source)
            );
        }

        return true;
    });
}


function prepareServerSearchFeed(incomingProducts = []) {
    /*
    ВАЖНО:
    Явный поиск должен строить ленту ТОЛЬКО из ответа текущего
    поискового запроса.

    Раньше здесь использовался весь allProducts. Из-за этого при
    переключении запроса/гонках загрузки в ленту могли попадать
    старые или вообще нерелевантные карточки.
    */

    const query = String(activeServerSearch.query || "").trim();

    if (!query) {
        return false;
    }

    const queryTokens = normalizeText(query)
        .split(/\s+/)
        .filter(Boolean);

    const sourceProducts = Array.isArray(incomingProducts)
        ? incomingProducts
        : [];

    const candidates = sourceProducts.filter(product => {
        if (!product) {
            return false;
        }

        const searchable = [
            product.title,
            product.brand,
            product.category,
            product.description,
            product.source,
            sourceLabel(product.source)
        ].join(" ").toLowerCase();

        if (!queryTokens.every(token => searchTokenMatches(token, searchable))) {
            return false;
        }

        if (
            activeServerSearch.sources &&
            activeServerSearch.sources.length
        ) {
            if (
                !activeServerSearch.sources.includes(
                    normalizeSearchSource(product.source)
                )
            ) {
                return false;
            }
        }

        if (
            activeServerSearch.minPrice !== null &&
            activeServerSearch.minPrice !== undefined
        ) {
            if (
                product.price === null ||
                Number(product.price) < Number(activeServerSearch.minPrice)
            ) {
                return false;
            }
        }

        if (
            activeServerSearch.maxPrice !== null &&
            activeServerSearch.maxPrice !== undefined
        ) {
            if (
                product.price === null ||
                Number(product.price) > Number(activeServerSearch.maxPrice)
            ) {
                return false;
            }
        }

        return true;
    });

    if (!candidates.length) {
        return false;
    }

    /*
    Сервер уже вернул правильный порядок.
    Сохраняем его, но просмотренные карточки переносим в конец.
    */
    const unviewed = candidates.filter(
        product => !isProductViewed(product)
    );

    products = unviewed.length
        ? unviewed.concat(
            candidates.filter(product => isProductViewed(product))
        )
        : candidates.slice();

    currentIndex = 0;
    resetNavigationHistory();
    currentProduct = null;

    rememberProductInNavigation(products[0]);

    /*
    Только после того, как реальные результаты готовы,
    переключаемся из поиска в ленту.
    */
    switchTab("feed");
    showProduct();

    return true;
}


async function loadMoreServerProducts() {
    if (
        serverSearchLoading ||
        !activeServerSearch.query ||
        !serverSearchHasMore
    ) {
        return false;
    }

    serverSearchLoading = true;

    try {
        const data = await fetchServerSearch(true);
        const incoming = Array.isArray(data.products)
            ? data.products.map(normalizeProduct)
            : [];

        const beforeIds = new Set(allProducts.map(product => String(product.id)));
        const fresh = incoming.filter(product => !beforeIds.has(String(product.id)));

        mergeProductsIntoCatalog(fresh);

        if (fresh.length) {
            // Если пользователь находится в серверной ленте, просто добавляем
            // новые карточки в конец, не сбрасывая текущую позицию.
            const existingIds = new Set(products.map(product => String(product.id)));
            fresh.forEach(product => {
                if (!existingIds.has(String(product.id))) {
                    products.push(product);
                }
            });
        }

        // Сервер сообщает fetched=0, когда следующей страницы больше нет.
        // Также останавливаемся, если новая выдача совсем не изменилась.
        if (!fresh.length || Number(data && data.fetched || 0) === 0) {
            serverSearchHasMore = false;
        }

        return fresh.length > 0;

    } catch (error) {
        console.error("[StyleFlow] Ошибка догрузки:", error);
        return false;
    } finally {
        serverSearchLoading = false;
        serverSearchLastFetchAt = Date.now();
    }
}


async function maybeLoadMoreServerProducts() {
    if (!activeServerSearch.query || serverSearchLoading || !serverSearchHasMore) {
        return;
    }

    // Догружаем заранее, когда до конца текущей серверной ленты осталось мало карточек.
    const remaining = products.length - currentIndex - 1;

    if (remaining <= 12) {
        await loadMoreServerProducts();
    }
}



function getTopUserInterests(limit = 8) {
    const profile = buildUserProfile();
    const combined = [];

    Object.entries(profile.keywords || {}).forEach(([word, score]) => {
        if (word.length < 2) return;
        combined.push({ text: word, score });
    });

    return combined
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function updateProfileInterests() {
    const box = document.getElementById("profileRecommendations");
    if (!box) return;

    const profile = buildUserProfile();
    const items = [];

    const pushInterest = (type, text, score, icon) => {
        const value = String(text || "").trim();
        if (
            !value ||
            value.length < 2 ||
            items.some(item => item.text === value)
        ) return;

        items.push({
            type,
            text: value,
            score: Number(score) || 0,
            icon
        });
    };

    Object.entries(profile.brands || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .forEach(([text, score]) =>
            pushInterest("brand", text, score, "🏷️")
        );

    Object.entries(profile.categories || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([text, score]) =>
            pushInterest("category", text, score, "◉")
        );

    Object.entries(profile.keywords || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([text, score]) => {
            if (text.length >= 3) {
                pushInterest("keyword", text, score, "✦");
            }
        });

    const top = items
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

    if (!top.length || profile.totalSignals < 3) {
        box.innerHTML = `
            <div class="profile-recommendation-empty">
                ✨ Пока я тебя изучаю. Листай, открывай и добавляй товары в избранное —
                здесь появятся персональные интересы.
            </div>
            <button
                class="profile-interest-button neutral"
                onclick="switchTab('search')"
            >
                🔎 Найти что-нибудь
            </button>
        `;
        return;
    }

    box.innerHTML = top.map(item => `
        <button
            class="profile-interest-button"
            onclick="quickSearch(${JSON.stringify(item.text)})"
        >
            <span class="profile-interest-icon">${item.icon}</span>
            <span class="profile-interest-text">
                <strong>${escapeHTML(item.text)}</strong>
                <small>Вам может понравиться</small>
            </span>
            <span class="profile-interest-arrow">→</span>
        </button>
    `).join("");
}

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
    updateProfileInterests();
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
        [
            ...viewedProducts
        ]
            .reverse()
            .slice(
                0,
                150
            );


    const recent =
        recentIds
            .map(
                id =>
                    allProducts.find(
                        product =>
                            String(
                                product.id
                            ) ===
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


    if (
        !recent.length
    ) {

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
        String(
            product.id
        );


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


        syncUserAction(
            "view",
            id
        );
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
        String(
            product.id
        );


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


    syncUserAction(
        "open",
        id
    );


    rebuildFeedAfterSignal();


    updateProfile();
}


/* =========================================================
SWIPE
========================================================= */

function toggleProductDetails() {
    const card = document.getElementById("productCard");
    if (!card) return;

    productDetailsCollapsed = !productDetailsCollapsed;
    card.classList.toggle("details-collapsed", productDetailsCollapsed);

    const button = document.getElementById("productDetailsToggle");
    if (button) {
        button.textContent = productDetailsCollapsed ? "⌃ Показать" : "⌄ Свернуть";
    }
}


function setupSwipe() {

    const card =
        document.getElementById(
            "productCard"
        );


    if (!card) {
        return;
    }

    // Все свайпы внутри карточки принадлежат ленте.
    card.style.touchAction = "none";
    card.style.webkitUserSelect = "none";
    card.style.userSelect = "none";


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

function resetNavigationHistory() {

    navigationHistory = [];
    navigationPosition = -1;
}


function rememberProductInNavigation(product) {

    if (!product) {
        return;
    }

    const id = String(product.id);

    if (
        navigationPosition >= 0 &&
        navigationPosition < navigationHistory.length - 1
    ) {
        navigationHistory = navigationHistory.slice(
            0,
            navigationPosition + 1
        );
    }

    if (
        navigationHistory.length === 0 ||
        String(navigationHistory[navigationHistory.length - 1]) !== id
    ) {
        navigationHistory.push(id);
    }

    navigationPosition = navigationHistory.length - 1;

    if (navigationHistory.length > NAVIGATION_HISTORY_LIMIT) {
        navigationHistory.shift();
        navigationPosition--;
    }
}


function rememberCurrentProduct() {

    rememberProductInNavigation(currentProduct);
}


function findProductById(id) {

    const target = String(id);

    return (
        products.find(
            product => String(product.id) === target
        ) ||
        allProducts.find(
            product => String(product.id) === target
        ) ||
        null
    );
}


async function nextProduct() {

    if (activeServerSearch.query && products.length) {
        void maybeLoadMoreServerProducts();
    } else if (products.length) {
        void maybeLoadMoreFeedProducts();
    }

    if (!products.length) {

        buildPersonalizedFeed();
        currentIndex = 0;

        if (!products.length) {
            showEmptyFeed();
            return;
        }

        resetNavigationHistory();
        showProduct();
        rememberCurrentProduct();
        return;
    }

    // Если мы до этого нажали "назад", сначала возвращаемся
    // вперёд по уже просмотренной истории, а не создаём новую карточку.
    if (
        navigationPosition >= 0 &&
        navigationPosition < navigationHistory.length - 1
    ) {
        navigationPosition++;

        const id = navigationHistory[navigationPosition];
        const product = findProductById(id);

        if (product) {
            const index = products.findIndex(
                item => String(item.id) === String(id)
            );

            if (index >= 0) {
                currentIndex = index;
            } else {
                products = [product, ...products];
                currentIndex = 0;
            }

            animateCardChange("next", true);
            return;
        }
    }

    const nextIndex =
        findNextUnviewedIndex(
            currentIndex,
            1
        );

    if (nextIndex >= 0) {

        rememberProductInNavigation(
            products[nextIndex]
        );

        currentIndex = nextIndex;

        animateCardChange("next");
        return;
    }

    // Пока активен явный серверный поиск, НИКОГДА не переключаемся
    // на общую персональную ленту. Сначала пытаемся получить следующую
    // страницу именно этого запроса. Это предотвращает появление
    // нерелевантных товаров (например, жвачки вместо наушников).
    if (activeServerSearch.query) {

        if (serverSearchHasMore) {
            const loaded = await loadMoreServerProducts();

            if (loaded) {
                const nextIndex = findNextUnviewedIndex(currentIndex, 1);

                if (nextIndex >= 0) {
                    rememberProductInNavigation(products[nextIndex]);
                    currentIndex = nextIndex;
                    animateCardChange("next");
                    return;
                }
            }
        }

        console.log(
            "[StyleFlow] Поисковая выдача закончилась."
        );

        showEmptyFeed();
        showToast("По этому запросу больше товаров нет");
        return;
    }

    // Если подошли к концу текущего пула, сначала синхронно пытаемся
    // получить следующую пачку. Пользователь не должен увидеть пустой
    // экран в момент, когда сервер ещё может дать новые карточки.
    if (feedHasMore) {
        const loaded = await loadMoreFeedProducts(true);

        if (loaded) {
            const nextAfterLoad = findNextUnviewedIndex(currentIndex, 1);

            if (nextAfterLoad >= 0) {
                rememberProductInNavigation(products[nextAfterLoad]);
                currentIndex = nextAfterLoad;
                animateCardChange("next");
                return;
            }
        }
    }

    const filteredProducts =
        applyProductFilters(allProducts);

    const unviewed =
        filteredProducts.filter(
            product => !isProductViewed(product)
        );

    if (unviewed.length > 0) {

        buildPersonalizedFeed();
        currentIndex = 0;

        if (products.length > 0) {
            rememberProductInNavigation(products[0]);
            animateCardChange("next");
        } else {
            showEmptyFeed();
        }

        return;
    }

    console.log(
        "[StyleFlow] Все доступные товары просмотрены."
    );

    showEmptyFeed();
    showToast("Ты просмотрел все доступные товары");
}


function previousProduct() {

    if (!products.length) {
        return;
    }

    // Главное: назад идём НЕ через findNextUnviewedIndex.
    // Просмотренный товар как раз и должен вернуться.
    if (navigationPosition > 0) {

        navigationPosition--;

        const id = navigationHistory[navigationPosition];
        const product = findProductById(id);

        if (!product) {
            return;
        }

        let index = products.findIndex(
            item => String(item.id) === String(id)
        );

        if (index < 0) {
            products = [product, ...products];
            index = 0;
        }

        currentIndex = index;

        animateCardChange("previous", true);
        return;
    }

    showToast("Это начало просмотренной ленты");
}


/* =========================================================
CARD ANIMATION
========================================================= */

function animateCardChange(
    direction,
    allowViewed = false
) {

    const card =
        document.getElementById(
            "productCard"
        );

    if (!card) {
        return;
    }

    card.style.opacity = "0";

    card.style.transform =
        direction === "next"
            ? "translateY(-20px)"
            : "translateY(20px)";

    setTimeout(
        () => {

            showProduct(allowViewed);

            requestAnimationFrame(
                () => {

                    card.style.opacity = "1";
                    card.style.transform = "";
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
ACCOUNT-SCOPED LOCAL STORAGE
========================================================= */

const ACCOUNT_LOCAL_KEYS = new Set([
    "styleflow_favorites",
    "styleflow_viewed",
    "styleflow_opened",
    "styleflow_search_history",
    "styleflow_filters",
    "styleflow_search_sources"
]);

function getAccountStorageKey(key) {
    if (ACCOUNT_LOCAL_KEYS.has(key) && styleflowAccountId) {
        return `styleflow_account_${styleflowAccountId}_${key}`;
    }
    return key;
}

function hydrateAccountLocalState() {
    if (!styleflowAccountId) return;

    favorites = loadJSON("styleflow_favorites", []);
    viewedProducts = loadJSON("styleflow_viewed", []);
    openedProducts = loadJSON("styleflow_opened", []);

    const accountFilters = loadJSON("styleflow_filters", null);
    if (accountFilters && typeof accountFilters === "object") {
        activeFilters = accountFilters;
    }
}


async function loadAccountFavorites() {
    if (!styleflowAccountId) return;

    try {
        const response = await fetch("/api/user/favorites", {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Favorites request failed: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.status === "ok" && Array.isArray(data.favorites)) {
            const localFavorites = Array.isArray(favorites) ? favorites : [];
            const merged = [];
            const seen = new Set();

            [...data.favorites, ...localFavorites].forEach(item => {
                if (!item || !item.id) return;
                const id = String(item.id);
                if (seen.has(id)) return;
                seen.add(id);
                merged.push(item);
            });

            favorites = merged;
            saveJSON("styleflow_favorites", favorites);

            // Если избранное было сохранено на этом устройстве до
            // появления серверной синхронизации, один раз переносим его на аккаунт.
            for (const item of localFavorites) {
                if (item && item.id) {
                    void syncFavoriteToServer(item, "add");
                }
            }

            console.log("[StyleFlow] Избранное аккаунта загружено:", favorites.length);
        }
    } catch (error) {
        console.error("[StyleFlow] Ошибка загрузки избранного:", error);
    }
}


async function syncFavoriteToServer(product, action) {
    if (!styleflowAccountId || !product || !product.id) return;

    try {
        const response = await fetch("/api/user/favorites", {
            method: action === "add" ? "POST" : "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
                action === "add"
                    ? { product }
                    : { product_id: String(product.id) }
            )
        });

        if (!response.ok) {
            throw new Error(`Favorites sync failed: ${response.status}`);
        }
    } catch (error) {
        console.error("[StyleFlow] Ошибка синхронизации избранного:", error);
    }
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
                getAccountStorageKey(key)
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
            getAccountStorageKey(key),
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

/* =========================================================
STYLEFLOW — UNIVERSAL RECOMMENDATION ENGINE V3
=========================================================

Главный принцип:
STYLEFLOW не предполагает заранее, что пользователь интересуется
одеждой. Профиль строится из реальных действий пользователя и
содержимого товаров/объявлений.

Сигналы:
- просмотр — слабый сигнал экспозиции;
- открытие — сильный сигнал намерения;
- избранное — очень сильный явный сигнал;
- поисковые запросы — сильный сигнал текущего намерения;
- свежесть действий — важнее старых;
- совпадение слов/фраз — дополнительный сигнал;
- категория/бренд/источник — структурные сигналы;
- цена — мягкое предпочтение, а не жёсткое правило.

Лента:
- никогда намеренно не возвращает просмотренное;
- ранжирует по релевантности;
- смешивает близкие интересы с небольшим exploration;
- ограничивает повторение одной темы/источника;
- постепенно меняет профиль по новым действиям.
========================================================= */

const SF_V3_VERSION = "3.0-universal";

const SF_V3_STOPWORDS = new Set([
    "и","или","но","а","в","во","на","по","из","за","для","с","со",
    "к","ко","у","от","до","о","об","про","как","что","это","так",
    "же","ли","бы","не","да","нет","все","всё","мой","моя","мои",
    "мое","твой","твоя","твои","этот","эта","эти","того","там","тут",
    "есть","был","была","были","будет","можно","нужно","хочу","ищу",
    "купить","найти","показать","покажи","товар","товары","объявление",
    "объявления","цена","новый","новая","новое","новые","шт","шт.",
    "руб","руб.","byn","бел","бел.р","рб"
]);

function sfV3NormalizeToken(value) {
    let word = String(value || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9]+/gi, "")
        .trim();

    if (word.length < 2 || SF_V3_STOPWORDS.has(word)) {
        return "";
    }

    /*
    Лёгкая нормализация окончаний.
    Это намеренно не полноценный морфологический анализатор:
    для браузерного Mini App он должен быть быстрым.
    */
    const endings = [
        "иями","ами","ого","ему","ому","ыми","ими","ая","яя",
        "ое","ее","ый","ий","ой","ые","ие","ов","ев","ам","ям",
        "ах","ях","ом","ем","ым","им","ую","юю","ою","ею",
        "а","я","ы","и","о","е","у","ю"
    ];

    for (const ending of endings) {
        if (word.length > ending.length + 3 &&
            word.endsWith(ending)) {
            word = word.slice(0, -ending.length);
            break;
        }
    }

    return word;
}

function sfV3Tokens(value) {
    return Array.from(
        new Set(
            String(value || "")
                .toLowerCase()
                .replace(/ё/g, "е")
                .split(/[^a-zа-я0-9]+/gi)
                .map(sfV3NormalizeToken)
                .filter(Boolean)
        )
    );
}

function sfV3ProductText(product) {
    if (!product) return "";

    return [
        product.title,
        product.brand,
        product.category,
        product.description,
        product.type,
        product.subtitle,
        product.raw && product.raw.name,
        product.raw && product.raw.product_name,
        product.raw && product.raw.description
    ]
        .filter(Boolean)
        .join(" ");
}

function sfV3CanonicalProductId(productOrId) {
    if (productOrId === null || productOrId === undefined) {
        return "";
    }

    if (typeof productOrId === "object") {
        const p = productOrId;

        const source = normalizeSource(
            p.source ||
            p.marketplace ||
            p.platform ||
            ""
        );

        const external = String(
            p.external_id ??
            p.externalId ??
            p.product_id ??
            p.productId ??
            ""
        ).trim();

        if (source && external) {
            return `${source}:${external}`;
        }

        return String(
            p.id ??
            external ??
            ""
        ).trim();
    }

    return String(productOrId).trim();
}

function sfV3ProductIdVariants(productOrId) {
    if (
        productOrId === null ||
        productOrId === undefined
    ) {
        return [];
    }

    if (typeof productOrId !== "object") {
        const raw = String(productOrId).trim();
        return raw ? [raw] : [];
    }

    const p = productOrId;
    const source = normalizeSource(
        p.source ||
        p.marketplace ||
        p.platform ||
        ""
    );

    const values = [
        p.id,
        p.external_id,
        p.externalId,
        p.product_id,
        p.productId
    ];

    if (source) {
        values.push(
            `${source}:${p.external_id || p.product_id || p.id || ""}`,
            `${source}_${p.external_id || p.product_id || p.id || ""}`
        );
    }

    return Array.from(
        new Set(
            values
                .filter(v => v !== null && v !== undefined)
                .map(v => String(v).trim())
                .filter(Boolean)
        )
    );
}

function sfV3SameProduct(a, b) {
    const left = new Set(
        sfV3ProductIdVariants(a)
    );

    return sfV3ProductIdVariants(b)
        .some(id => left.has(id));
}

function sfV3IsViewed(product) {
    if (!product) return true;

    return Array.isArray(viewedProducts) &&
        viewedProducts.some(
            id => sfV3SameProduct(id, product)
        );
}

function sfV3ActionRecency(index, total) {
    if (!total) return 1;

    /*
    Последнее действие ≈ 1.0.
    Старые действия постепенно ослабевают, но не исчезают мгновенно.
    */
    const position = (index + 1) / total;

    return 0.35 + Math.pow(position, 0.65) * 0.65;
}

function sfV3AddMap(map, key, amount) {
    if (!key) return;

    map[key] =
        (Number(map[key]) || 0) +
        amount;
}

function sfV3AddTokens(profile, text, weight) {
    sfV3Tokens(text).forEach(token => {
        sfV3AddMap(
            profile.keywords,
            token,
            weight
        );
    });
}

function sfV3AddProductSignal(
    profile,
    product,
    weight,
    options = {}
) {
    if (!product || !Number.isFinite(weight)) {
        return;
    }

    const category = normalizeText(
        product.category
    );

    const brand = normalizeText(
        product.brand
    );

    const source = normalizeText(
        product.source
    );

    sfV3AddMap(
        profile.categories,
        category,
        weight
    );

    sfV3AddMap(
        profile.brands,
        brand,
        weight
    );

    sfV3AddMap(
        profile.sources,
        source,
        weight
    );

    sfV3AddTokens(
        profile,
        sfV3ProductText(product),
        weight * 0.72
    );

    if (
        product.price !== null &&
        Number.isFinite(Number(product.price))
    ) {
        profile.prices.push({
            price: Number(product.price),
            weight
        });
    }

    if (options.countSignal !== false) {
        profile.totalSignals += weight;
    }
}

function sfV3FindHistoryProduct(id) {
    /*
    Сначала обычный поиск проекта.
    Затем расширенный поиск по всем ID-вариантам.
    */
    const direct = findProductById(id);

    if (direct) {
        return direct;
    }

    const catalog = [
        ...(Array.isArray(allProducts) ? allProducts : []),
        ...(Array.isArray(products) ? products : [])
    ];

    return catalog.find(
        product => sfV3SameProduct(id, product)
    ) || null;
}

function sfV3GetSearchHistory() {
    const raw = loadJSON(
        "styleflow_search_history",
        []
    );

    if (!Array.isArray(raw)) {
        return [];
    }

    return raw
        .map(entry => {
            if (typeof entry === "string") {
                return {
                    query: entry,
                    weight: 1
                };
            }

            return {
                query: entry && entry.query
                    ? entry.query
                    : "",
                weight:
                    Number(entry && entry.weight) || 1
            };
        })
        .filter(entry => entry.query);
}

/* =========================================================
UNIVERSAL USER PROFILE
========================================================= */

function buildUserProfile() {
    const profile = {
        categories: {},
        brands: {},
        sources: {},
        keywords: {},
        prices: [],
        totalSignals: 0,
        explicitSignals: 0,
        viewedOnlySignals: 0,
        searchIntent: {},
        generatedAt: Date.now()
    };

    const viewed = Array.isArray(viewedProducts)
        ? viewedProducts.slice(-250)
        : [];

    viewed.forEach((id, index) => {
        const product = sfV3FindHistoryProduct(id);
        if (!product) return;

        const recency =
            sfV3ActionRecency(
                index,
                viewed.length
            );

        /*
        Сам просмотр — не считаем доказательством любви.
        Это только слабый сигнал того, что направление было показано.
        */
        sfV3AddProductSignal(
            profile,
            product,
            0.35 * recency
        );

        profile.viewedOnlySignals += 1;
    });

    const opened = Array.isArray(openedProducts)
        ? openedProducts.slice(-180)
        : [];

    opened.forEach((id, index) => {
        const product = sfV3FindHistoryProduct(id);
        if (!product) return;

        const recency =
            sfV3ActionRecency(
                index,
                opened.length
            );

        sfV3AddProductSignal(
            profile,
            product,
            4.5 * recency
        );

        profile.explicitSignals += 1;
    });

    (Array.isArray(favorites) ? favorites : [])
        .forEach(productRaw => {
            const product =
                normalizeProduct(
                    productRaw
                );

            if (!product) return;

            sfV3AddProductSignal(
                profile,
                product,
                9.5
            );

            profile.explicitSignals += 1;
        });

    const searches =
        sfV3GetSearchHistory()
            .slice(-50);

    searches.forEach((entry, index) => {
        const recency =
            sfV3ActionRecency(
                index,
                searches.length
            );

        const queryWeight =
            5.5 *
            recency *
            Math.max(
                0.5,
                Number(entry.weight) || 1
            );

        const tokens =
            sfV3Tokens(
                entry.query
            );

        tokens.forEach(token => {
            sfV3AddMap(
                profile.keywords,
                token,
                queryWeight
            );

            sfV3AddMap(
                profile.searchIntent,
                token,
                queryWeight
            );
        });

        profile.totalSignals +=
            queryWeight;

        profile.explicitSignals += 1;
    });

    return profile;
}

/* =========================================================
SIMILARITY
========================================================= */

function sfV3TokenSimilarity(
    productTokens,
    profileKeywords
) {
    if (!productTokens.length) {
        return 0;
    }

    let matched = 0;
    let totalImportance = 0;

    productTokens.forEach(token => {
        const value =
            Number(
                profileKeywords[token]
            ) || 0;

        if (value > 0) {
            matched += Math.min(
                1,
                value / 10
            );

            totalImportance +=
                Math.min(
                    2.5,
                    value / 8
                );
        }
    });

    return Math.min(
        1,
        (matched / productTokens.length) * 0.65 +
        (totalImportance /
            Math.max(1, productTokens.length * 1.4)
        ) * 0.35
    );
}

function sfV3PriceFit(product, profile) {
    if (
        !product ||
        product.price === null ||
        !Number.isFinite(Number(product.price)) ||
        !profile.prices.length
    ) {
        return 0;
    }

    const price =
        Number(product.price);

    let totalWeight = 0;
    let weightedFit = 0;

    profile.prices.forEach(item => {
        const p = Number(item.price);
        const w = Number(item.weight) || 0;

        if (
            !Number.isFinite(p) ||
            p <= 0 ||
            w <= 0
        ) {
            return;
        }

        /*
        Относительное расстояние лучше абсолютного:
        20 BYN для дешёвого товара и 20 BYN для дорогого товара
        означают совершенно разное.
        */
        const distance =
            Math.abs(price - p) /
            Math.max(
                1,
                Math.max(price, p)
            );

        const fit =
            Math.exp(
                -Math.pow(distance / 0.28, 2)
            );

        weightedFit +=
            fit * w;

        totalWeight += w;
    });

    if (!totalWeight) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            1,
            weightedFit / totalWeight
        )
    );
}

function sfV3Freshness(product) {
    const rawDate =
        product &&
        (
            product.updated_at ||
            product.updatedAt ||
            product.created_at ||
            product.createdAt
        );

    const timestamp =
        new Date(rawDate || 0).getTime();

    if (
        !Number.isFinite(timestamp) ||
        timestamp <= 0
    ) {
        return 0;
    }

    const ageDays =
        Math.max(
            0,
            (Date.now() - timestamp) /
            86400000
        );

    return Math.exp(
        -ageDays / 14
    );
}

/* =========================================================
SMART SCORE
========================================================= */

function calculateRecommendationScore(
    product,
    profile
) {
    if (!product || !profile) {
        return 0;
    }

    const tokens =
        sfV3Tokens(
            sfV3ProductText(product)
        );

    const keywordSimilarity =
        sfV3TokenSimilarity(
            tokens,
            profile.keywords
        );

    const category =
        normalizeText(
            product.category
        );

    const brand =
        normalizeText(
            product.brand
        );

    const source =
        normalizeText(
            product.source
        );

    const categoryAffinity =
        category &&
        profile.categories[category]
            ? Math.min(
                1,
                profile.categories[category] / 24
            )
            : 0;

    const brandAffinity =
        brand &&
        profile.brands[brand]
            ? Math.min(
                1,
                profile.brands[brand] / 18
            )
            : 0;

    const sourceAffinity =
        source &&
        profile.sources[source]
            ? Math.min(
                1,
                profile.sources[source] / 35
            )
            : 0;

    const priceFit =
        sfV3PriceFit(
            product,
            profile
        );

    const searchFit =
        sfV3TokenSimilarity(
            tokens,
            profile.searchIntent
        );

    const freshness =
        sfV3Freshness(
            product
        );

    /*
    Баланс намерения:
    - поиск и содержание товара;
    - точные структурные совпадения;
    - цена;
    - источник;
    - свежесть.

    Никакой отдельный признак не способен один
    полностью определить результат.
    */
    let score =
        keywordSimilarity * 34 +
        searchFit * 22 +
        categoryAffinity * 18 +
        brandAffinity * 20 +
        priceFit * 13 +
        sourceAffinity * 5 +
        freshness * 3;

    /*
    Сильный бонус, если товар одновременно совпал
    по нескольким признакам. Например:
    "наушники" + Sony + привычный диапазон цены.
    */
    const matchedDimensions =
        [
            keywordSimilarity >= 0.25,
            searchFit >= 0.25,
            categoryAffinity >= 0.25,
            brandAffinity >= 0.25,
            priceFit >= 0.55
        ]
            .filter(Boolean)
            .length;

    if (matchedDimensions >= 3) {
        score += 10;
    }

    if (matchedDimensions >= 4) {
        score += 8;
    }

    /*
    Очень маленькая случайность нужна только
    для разведения почти одинаковых карточек.
    */
    score += Math.random() * 0.35;

    return Math.max(
        0,
        score
    );
}

/* =========================================================
DIVERSIFIED PERSONALIZED FEED
========================================================= */

function buildPersonalizedFeed() {
    if (!Array.isArray(allProducts) || !allProducts.length) {
        products = [];
        return;
    }

    const filtered =
        applyProductFilters(
            allProducts
        );

    const candidates =
        filtered.filter(
            product =>
                !product.isAdult &&
                !sfV3IsViewed(product)
        );

    if (!candidates.length) {
        products = [];
        return;
    }

    /*
    Явные сортировки пользователя имеют приоритет.
    */
    if (activeFilters.sort === "price_asc") {
        products = sortByPrice(
            candidates,
            "asc"
        );
        return;
    }

    if (activeFilters.sort === "price_desc") {
        products = sortByPrice(
            candidates,
            "desc"
        );
        return;
    }

    if (activeFilters.sort === "newest") {
        products = sortNewest(
            candidates
        );
        return;
    }

    const profile =
        buildUserProfile();

    const signalLevel =
        Math.min(
            1,
            (
                Number(profile.totalSignals) || 0
            ) / 42
        );

    /*
    Для нового пользователя больше exploration.
    По мере накопления поведения алгоритм становится точнее.
    Но exploration никогда не исчезает полностью.
    */
    const explorationRatio =
        0.38 -
        signalLevel * 0.28;

    const scored =
        candidates.map(
            product => ({
                product,
                score:
                    calculateRecommendationScore(
                        product,
                        profile
                    ),
                tokens:
                    new Set(
                        sfV3Tokens(
                            sfV3ProductText(
                                product
                            )
                        )
                    )
            })
        );

    /*
    Сначала сортируем по силе интереса.
    */
    scored.sort(
        (a, b) =>
            b.score - a.score
    );

    const result = [];
    const remaining = scored.slice();

    let lastSource = "";
    let sourceStreak = 0;

    let lastCategory = "";
    let categoryStreak = 0;

    while (remaining.length) {
        let available =
            remaining.filter(
                entry => {
                    const category =
                        normalizeText(
                            entry.product.category
                        );

                    const source =
                        normalizeText(
                            entry.product.source
                        );

                    const categoryBlocked =
                        category &&
                        category === lastCategory &&
                        categoryStreak >= 2;

                    const sourceBlocked =
                        source &&
                        source === lastSource &&
                        sourceStreak >= 3;

                    return !(
                        categoryBlocked ||
                        sourceBlocked
                    );
                }
            );

        if (!available.length) {
            available = remaining;
        }

        /*
        Exploration:
        выбираем один из менее очевидных кандидатов,
        но не полностью случайный товар.
        */
        let selected;

        if (
            Math.random() <
            explorationRatio
        ) {
            const topPoolSize =
                Math.min(
                    available.length,
                    Math.max(
                        5,
                        Math.ceil(
                            available.length * 0.30
                        )
                    )
                );

            const pool =
                available
                    .slice()
                    .sort(
                        (a, b) =>
                            b.score - a.score
                    )
                    .slice(
                        0,
                        topPoolSize
                    );

            selected =
                pool[
                    Math.floor(
                        Math.random() *
                        pool.length
                    )
                ];

        } else {
            /*
            В exploitation используем score с мягким
            уменьшением разрыва между соседями.
            */
            const poolSize =
                Math.min(
                    available.length,
                    12
                );

            const pool =
                available
                    .slice()
                    .sort(
                        (a, b) =>
                            b.score - a.score
                    )
                    .slice(
                        0,
                        poolSize
                    );

            const maxScore =
                Math.max(
                    1,
                    ...pool.map(
                        item => item.score
                    )
                );

            const weighted =
                pool.map(
                    item => ({
                        item,
                        weight:
                            0.25 +
                            Math.pow(
                                Math.max(
                                    0,
                                    item.score /
                                    maxScore
                                ),
                                2.2
                            ) * 8
                    })
                );

            const total =
                weighted.reduce(
                    (sum, item) =>
                        sum + item.weight,
                    0
                );

            let random =
                Math.random() *
                total;

            selected =
                weighted[
                    weighted.length - 1
                ].item;

            for (const item of weighted) {
                random -= item.weight;

                if (random <= 0) {
                    selected = item.item;
                    break;
                }
            }
        }

        const index =
            remaining.indexOf(
                selected
            );

        if (index >= 0) {
            remaining.splice(
                index,
                1
            );
        }

        const category =
            normalizeText(
                selected.product.category
            );

        const source =
            normalizeText(
                selected.product.source
            );

        if (category === lastCategory) {
            categoryStreak += 1;
        } else {
            lastCategory = category;
            categoryStreak = 1;
        }

        if (source === lastSource) {
            sourceStreak += 1;
        } else {
            lastSource = source;
            sourceStreak = 1;
        }

        result.push(
            selected.product
        );
    }

    products = result;

    console.log(
        "[StyleFlow V3] Универсальная персональная лента:",
        {
            candidates: candidates.length,
            result: products.length,
            signals: profile.totalSignals,
            exploration:
                Math.round(
                    explorationRatio * 100
                ) + "%"
        }
    );
}

/* =========================================================
PROFILE — "ВАМ МОЖЕТ ПОНРАВИТЬСЯ"
========================================================= */

function sfV3GetRecommendationTopics(limit = 5) {
    const profile =
        buildUserProfile();

    const topics = [];

    const addTopic = (
        text,
        score,
        query
    ) => {
        const clean =
            String(text || "")
                .trim();

        if (
            !clean ||
            clean.length < 2 ||
            !query
        ) {
            return;
        }

        const duplicate =
            topics.some(
                item =>
                    normalizeText(
                        item.query
                    ) ===
                    normalizeText(
                        query
                    )
            );

        if (duplicate) {
            return;
        }

        topics.push({
            text: clean,
            query: String(query),
            score:
                Number(score) || 0
        });
    };

    Object.entries(
        profile.searchIntent || {}
    ).forEach(
        ([token, score]) => {
            addTopic(
                token,
                score + 50,
                token
            );
        }
    );

    Object.entries(
        profile.brands || {}
    ).forEach(
        ([brand, score]) => {
            addTopic(
                brand,
                score + 35,
                brand
            );
        }
    );

    Object.entries(
        profile.categories || {}
    ).forEach(
        ([category, score]) => {
            addTopic(
                category,
                score + 20,
                category
            );
        }
    );

    Object.entries(
        profile.keywords || {}
    ).forEach(
        ([keyword, score]) => {
            addTopic(
                keyword,
                score,
                keyword
            );
        }
    );

    return topics
        .sort(
            (a, b) =>
                b.score - a.score
        )
        .slice(
            0,
            limit
        );
}

function sfV3SearchByTopic(query) {
    const clean =
        String(query || "")
            .trim();

    if (!clean) {
        return;
    }

    activeFilters = {
        ...activeFilters,
        query: clean,
        sort: "relevance"
    };

    saveJSON(
        "styleflow_filters",
        activeFilters
    );

    /*
    Если в проекте есть существующий search launcher,
    используем его. Иначе просто перестраиваем локальную ленту.
    */
    const input =
        document.getElementById(
            "searchInput"
        );

    if (input) {
        input.value = clean;
    }

    switchTab("feed");

    if (typeof renderFilterState === "function") {
        try {
            renderFilterState();
        } catch (e) {}
    }

    buildPersonalizedFeed();

    currentIndex = 0;

    resetNavigationHistory();

    showProduct();

    showToast(
        `Подбираем: ${clean}`
    );
}

function sfV3OpenFreshDiscovery() {
    activeFilters = {
        ...activeFilters,
        query: "",
        sort: "relevance"
    };

    saveJSON(
        "styleflow_filters",
        activeFilters
    );

    switchTab("feed");

    buildPersonalizedFeed();

    currentIndex = 0;

    resetNavigationHistory();

    showProduct();

    showToast(
        "Показываем что-то новое"
    );
}

function renderProfileRecommendations() {
    const container =
        document.getElementById(
            "profileRecommendations"
        );

    if (!container) {
        return;
    }

    const topics =
        sfV3GetRecommendationTopics(
            5
        );

    container.innerHTML = "";

    if (!topics.length) {
        container.innerHTML = `
            <button
                type="button"
                class="profile-recommendation-button profile-recommendation-main"
                onclick="sfV3OpenFreshDiscovery()"
            >
                <span class="profile-rec-icon">✨</span>
                <span>
                    <strong>Попробовать что-то новое</strong>
                    <small>Алгоритм начнёт изучать твои интересы</small>
                </span>
            </button>

            <button
                type="button"
                class="profile-recommendation-button"
                onclick="switchTab('search')"
            >
                <span class="profile-rec-icon">🔎</span>
                <span>
                    <strong>Найти что угодно</strong>
                    <small>Товар, техника, авто, услуги и другое</small>
                </span>
            </button>
        `;

        return;
    }

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "profile-recommendation-caption";

    header.textContent =
        "На основе твоих поисков и действий";

    container.appendChild(
        header
    );

    topics.forEach(
        topic => {
            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "profile-recommendation-button";

            button.innerHTML = `
                <span class="profile-rec-icon">✦</span>
                <span>
                    <strong>${escapeHTML(
                        capitalize(
                            topic.text
                        )
                    )}</strong>
                    <small>Вам может понравиться</small>
                </span>
            `;

            button.addEventListener(
                "click",
                () => {
                    sfV3SearchByTopic(
                        topic.query
                    );
                }
            );

            container.appendChild(
                button
            );
        }
    );

    const fresh =
        document.createElement(
            "button"
        );

    fresh.type = "button";

    fresh.className =
        "profile-recommendation-button profile-recommendation-fresh";

    fresh.innerHTML = `
        <span class="profile-rec-icon">🌐</span>
        <span>
            <strong>Что-нибудь новое</strong>
            <small>Исследовать другие интересы</small>
        </span>
    `;

    fresh.addEventListener(
        "click",
        sfV3OpenFreshDiscovery
    );

    container.appendChild(
        fresh
    );
}

function updateProfileInterests() {
    renderProfileRecommendations();
}

/*
Переопределяем профиль, чтобы новый блок
обновлялся вместе со статистикой.
*/
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
            Array.isArray(favorites)
                ? favorites.length
                : 0;
    }

    if (viewedCount) {
        viewedCount.textContent =
            Array.isArray(viewedProducts)
                ? viewedProducts.length
                : 0;
    }

    if (openedCount) {
        openedCount.textContent =
            Array.isArray(openedProducts)
                ? openedProducts.length
                : 0;
    }

    if (collectionCount) {
        const count =
            Array.isArray(favorites)
                ? favorites.length
                : 0;

        collectionCount.textContent =
            `${count} ${getRussianPlural(
                count,
                "товар",
                "товара",
                "товаров"
            )}`;
    }

    renderProfileRecommendations();

    if (
        typeof renderRecentProducts ===
        "function"
    ) {
        renderRecentProducts();
    }
}

/* =========================================================
UNIVERSAL CATEGORY FALLBACK
========================================================= */

function sfV3DisplayCategory(product) {
    if (!product) {
        return "";
    }

    const value =
        String(
            product.category || ""
        ).trim();

    if (
        !value ||
        /^\\d+$/.test(value)
    ) {
        return "";
    }

    return value;
}

/*
Обновляем текст категории карточки без
автоматического "Одежда".
*/
function sfV3PatchProductCategoryLabel() {
    const category =
        document.getElementById(
            "productCategory"
        );

    if (!category || !currentProduct) {
        return;
    }

    category.textContent =
        sfV3DisplayCategory(
            currentProduct
        );
}

/*
После каждой карточки можно безопасно обновить
подпись категории.
*/
const sfV3OriginalShowProduct =
    showProduct;

function sfV3ShowProductWrapper() {
    sfV3OriginalShowProduct();

    try {
        sfV3PatchProductCategoryLabel();
    } catch (e) {}
}

showProduct =
    sfV3ShowProductWrapper;

/* =========================================================
BOOT
========================================================= */

setTimeout(
    () => {
        try {
            updateProfile();
        } catch (e) {}
    },
    0
);
