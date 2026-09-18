/* =========================================================
STYLEFLOW
Personalized marketplace feed

ЭТАП 3:

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


/* =========================================================
SERVER USER HISTORY
========================================================= */

let telegramUserId = null;

let userHistoryLoaded = false;


/* =========================================================
RECOMMENDATION SETTINGS
========================================================= */

const PERSONALIZATION_START =
    5;

const PERSONALIZATION_FULL =
    50;


const MIN_RANDOM_RATIO =
    0.20;

const MAX_RANDOM_RATIO =
    0.75;


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

            return String(
                Telegram.WebApp
                    .initDataUnsafe
                    .user
                    .id
            );
        }

    } catch (error) {

        console.error(
            "[StyleFlow] Ошибка получения Telegram user.id:",
            error
        );
    }


    return "";
}


/* =========================================================
START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupSearch();

        setupSwipe();


        /*
        Получаем Telegram пользователя
        до загрузки товаров.
        */

        telegramUserId =
            getTelegramUserId();


        console.log(
            "[StyleFlow] Telegram user ID:",
            telegramUserId || "не найден"
        );


        /*
        Сначала загружаем историю.

        Это очень важно.

        Если сначала загрузить товары,
        а историю получить позже,
        пользователь может увидеть
        уже просмотренный товар.
        */

        await loadUserHistory();


        /*
        Теперь загружаем каталог.
        */

        await loadFeed();


        updateProfile();
    }
);


/* =========================================================
LOAD USER HISTORY
========================================================= */

async function loadUserHistory() {

    /*
    Если Mini App открыт не внутри Telegram
    или Telegram user.id недоступен,
    продолжаем работать на localStorage.
    */

    if (!telegramUserId) {

        console.log(
            "[StyleFlow] Telegram user.id не найден. Используем localStorage."
        );


        userHistoryLoaded = true;

        return;
    }


    try {

        const response =
            await fetch(
                `/api/user/history?user_id=${encodeURIComponent(
                    telegramUserId
                )}`,
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

            /*
            Объединяем серверную историю
            с локальной.

            Дубликаты удаляются.
            */

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


            /*
            Ограничиваем локальный кэш.
            */

            if (
                viewedProducts.length >
                500
            ) {

                viewedProducts =
                    viewedProducts.slice(
                        -500
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


        /*
        Даже если сервер истории временно
        недоступен, приложение продолжает
        работать через localStorage.
        */

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

                    user_id:
                        telegramUserId,

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

async function loadFeed() {

    try {

        const response =
            await fetch(
                "/api/feed",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Feed request failed"
            );
        }


        const data =
            await response.json();


        console.log(
            "[StyleFlow] Feed response:",
            data
        );


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
            rawProducts.map(
                normalizeProduct
            );


        console.log(
            "[StyleFlow] Нормализовано товаров:",
            allProducts.length
        );


        if (
            allProducts.length > 0
        ) {

            console.log(
                "[StyleFlow] Первый товар:",
                allProducts[0]
            );
        }


        localStorage.setItem(
            "styleflow_main_feed",
            JSON.stringify(
                allProducts
            )
        );


        buildPersonalizedFeed();


        currentIndex = 0;


        if (
            products.length > 0
        ) {

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


        if (
            cached.length > 0
        ) {

            allProducts =
                cached.map(
                    normalizeProduct
                );


            buildPersonalizedFeed();


            currentIndex = 0;


            if (
                products.length > 0
            ) {

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
PERSONALIZED FEED
========================================================= */

function buildPersonalizedFeed() {

    if (
        !allProducts.length
    ) {

        products = [];

        return;
    }


    const viewedSet =
        new Set(
            viewedProducts.map(
                String
            )
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
    ВАЖНО:

    Если товар уже просмотрен —
    он больше не возвращается
    автоматически.

    Когда в базу добавятся новые товары,
    они будут непросмотренными
    и попадут в ленту.
    */

    const candidates =
        unviewed;


    if (
        !candidates.length
    ) {

        products = [];


        console.log(
            "[StyleFlow] Все доступные товары уже просмотрены."
        );


        return;
    }


    const profile =
        buildUserProfile();


    const personalization =
        getPersonalizationStrength(
            profile.totalSignals
        );


    console.log(
        "[StyleFlow] Сила персонализации:",
        personalization
    );


    const shuffled =
        shuffleArray(
            candidates
        );


    if (
        personalization <= 0
    ) {

        products =
            buildDiverseRandomFeed(
                shuffled
            );


        console.log(
            "[StyleFlow] Новая лента — полностью случайная"
        );


        return;
    }


    const scored =
        candidates.map(
            product => ({

                product,

                score:
                    calculateRecommendationScore(
                        product,
                        profile
                    )
            })
        );


    products =
        buildWeightedDiverseFeed(
            scored,
            personalization
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
        personalization;


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

        prices: [],

        totalSignals: 0
    };


    viewedProducts.forEach(
        id => {

            const product =
                findProductById(id);


            if (!product) {
                return;
            }


            addProfileSignal(
                profile,
                product,
                1
            );
        }
    );


    openedProducts.forEach(
        id => {

            const product =
                findProductById(id);


            if (!product) {
                return;
            }


            addProfileSignal(
                profile,
                product,
                3
            );
        }
    );


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

    let score = 0;


    const category =
        normalizeText(
            product.category
        );


    if (
        category &&
        profile.categories[
            category
        ]
    ) {

        score +=
            profile.categories[
                category
            ] *
            5;
    }


    const brand =
        normalizeText(
            product.brand
        );


    if (
        brand &&
        profile.brands[
            brand
        ]
    ) {

        score +=
            profile.brands[
                brand
            ] *
            7;
    }


    const source =
        normalizeText(
            product.source
        );


    if (
        source &&
        profile.sources[
            source
        ]
    ) {

        score +=
            profile.sources[
                source
            ] *
            2;
    }


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
                    Number(
                        product.price
                    ) -
                    averagePrice
                );


            const percentage =
                difference /
                averagePrice;


            if (
                percentage <= 0.10
            ) {

                score += 12;

            } else if (
                percentage <= 0.25
            ) {

                score += 7;

            } else if (
                percentage <= 0.50
            ) {

                score += 3;
            }
        }
    }


    score +=
        Math.random() * 4;


    return Math.max(
        0,
        score
    );
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

function showProduct() {

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
        "Одежда";


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

            document
                .getElementById(id)
                .classList
                .remove(
                    "active"
                );
        }
    );


    document
        .getElementById(
            screens[tab]
        )
        .classList
        .add(
            "active"
        );


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
                .remove(
                    "active"
                );
        }
    );


    document
        .getElementById(
            navs[tab]
        )
        .classList
        .add(
            "active"
        );


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
                String(
                    currentProduct.id
                )
        );


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


        showToast(
            "❤️ Добавлено в избранное"
        );


        showHeart();
    }


    saveJSON(
        "styleflow_favorites",
        favorites
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

        document
            .getElementById(
                "commentsOverlay"
            )
            .classList
            .remove(
                "show"
            );
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
        .remove(
            "active"
        );


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


    if (
        !filtered.length
    ) {

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
        [
            ...viewedProducts
        ]
            .reverse()
            .slice(
                0,
                6
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


        /*
        Сохраняем просмотр
        на сервере.

        Это выполняется асинхронно
        и не блокирует интерфейс.
        */

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


    /*
    Сохраняем открытие
    на сервере.
    */

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

    if (
        !products.length
    ) {

        buildPersonalizedFeed();


        currentIndex = 0;


        if (
            !products.length
        ) {

            showEmptyFeed();

            return;
        }


        showProduct();

        return;
    }


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


    const unviewed =
        allProducts.filter(
            product =>
                !isProductViewed(
                    product
                )
        );


    if (
        unviewed.length > 0
    ) {

        buildPersonalizedFeed();


        currentIndex = 0;


        if (
            products.length > 0
        ) {

            animateCardChange(
                "next"
            );

        } else {

            showEmptyFeed();
        }


        return;
    }


    /*
    НОВОЕ ПОВЕДЕНИЕ:

    Не начинаем новый круг.

    Пользователь просмотрел всё,
    что было доступно.

    Ждём появления новых товаров.
    */

    console.log(
        "[StyleFlow] Все доступные товары просмотрены."
    );


    showEmptyFeed();


    showToast(
        "Ты просмотрел все доступные товары"
    );
}


function previousProduct() {

    if (
        !products.length
    ) {

        return;
    }


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
