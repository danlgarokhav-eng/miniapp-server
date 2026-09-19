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

let telegramUserId = null;
let userHistoryLoaded = false;

let activeFilters = loadJSON("styleflow_filters", {
    minPrice: null,
    maxPrice: null,
    categories: [],
    sources: []
});

const PERSONALIZATION_START = 5;
const PERSONALIZATION_FULL = 50;

const MIN_RANDOM_RATIO = 0.20;
const MAX_RANDOM_RATIO = 0.75;

const MAX_SAME_CATEGORY_STREAK = 2;
const MAX_SAME_SOURCE_STREAK = 3;

const SOURCE_LABELS = {
    wildberries: "🟣 Wildberries",
    ozon: "🔵 Ozon",
    aliexpress: "🟠 AliExpress",
    kufar: "🟢 Kufar",
    marketplace: "🛍 Marketplace"
};

const SOURCE_LIST = [
    {
        value: "kufar",
        label: "🟢 Kufar"
    },
    {
        value: "wildberries",
        label: "🟣 Wildberries"
    },
    {
        value: "ozon",
        label: "🔵 Ozon"
    },
    {
        value: "aliexpress",
        label: "🟠 AliExpress"
    }
];

const CATEGORY_ALIASES = {
    "одежда": "Одежда",
    "обувь": "Обувь",
    "футболка": "Футболки",
    "футболки": "Футболки",
    "майка": "Футболки",
    "худи": "Худи",
    "толстовка": "Худи",
    "свитшот": "Худи",
    "джинсы": "Джинсы",
    "джинс": "Джинсы",
    "брюки": "Брюки",
    "штаны": "Брюки",
    "куртка": "Куртки",
    "куртки": "Куртки",
    "пальто": "Верхняя одежда",
    "пуховик": "Верхняя одежда",
    "верхняя одежда": "Верхняя одежда",
    "платье": "Платья",
    "платья": "Платья",
    "юбка": "Юбки",
    "юбки": "Юбки",
    "рубашка": "Рубашки",
    "рубашки": "Рубашки",
    "сумка": "Сумки",
    "сумки": "Сумки",
    "аксессуары": "Аксессуары",
    "аксессуар": "Аксессуары",
    "головной убор": "Аксессуары",
    "кроссовки": "Обувь",
    "ботинки": "Обувь",
    "туфли": "Обувь",
    "сандалии": "Обувь"
};

function loadJSON(key, fallback) {
    try {
        const value = localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        const parsed = JSON.parse(value);

        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore
    }
}

function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function uniqueArray(array) {
    return [...new Set(
        Array.isArray(array)
            ? array.filter(Boolean)
            : []
    )];
}

function mergeUniqueIds(oldIds, newIds) {
    return uniqueArray([
        ...(Array.isArray(oldIds) ? oldIds : []),
        ...(Array.isArray(newIds) ? newIds : [])
    ]);
}

function mergeIds(oldIds, newIds) {
    return [
        ...(Array.isArray(oldIds) ? oldIds : []),
        ...(Array.isArray(newIds) ? newIds : [])
    ];
}

function getProductId(product) {
    return String(
        product?.id ??
        product?.product_id ??
        product?.external_id ??
        ""
    );
}

function getTelegramUserId() {
    try {
        const tg = window.Telegram?.WebApp;

        if (!tg) {
            return null;
        }

        const user = tg.initDataUnsafe?.user;

        return user?.id
            ? String(user.id)
            : null;
    } catch {
        return null;
    }
}

function detectSource(url = "") {
    const value = normalizeText(url);

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
    const value = normalizeText(source);

    if (
        value.includes("wildberries") ||
        value === "wb"
    ) {
        return "wildberries";
    }

    if (value.includes("ozon")) {
        return "ozon";
    }

    if (
        value.includes("aliexpress") ||
        value.includes("ali express")
    ) {
        return "aliexpress";
    }

    if (value.includes("kufar")) {
        return "kufar";
    }

    return value || "marketplace";
}

function sourceLabel(source) {
    return SOURCE_LABELS[
        normalizeSource(source)
    ] || "🛍 Marketplace";
}

function parsePrice(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (typeof value === "number") {
        return Number.isFinite(value)
            ? value
            : null;
    }

    let text = String(value)
        .trim()
        .replace(/\s/g, "")
        .replace(/[^\d.,-]/g, "");

    if (!text) {
        return null;
    }

    const hasComma = text.includes(",");
    const hasDot = text.includes(".");

    if (hasComma && hasDot) {
        if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
            text = text.replace(/\./g, "");
            text = text.replace(",", ".");
        } else {
            text = text.replace(/,/g, "");
        }
    } else if (hasComma) {
        text = text.replace(",", ".");
    }

    const number = Number(text);

    return Number.isFinite(number)
        ? number
        : null;
}

function detectCurrency(value) {
    const text = String(value ?? "").toUpperCase();

    if (text.includes("BYN") || text.includes("БИН")) {
        return "BYN";
    }

    if (
        text.includes("RUB") ||
        text.includes("₽") ||
        text.includes("РУБ")
    ) {
        return "RUB";
    }

    if (
        text.includes("USD") ||
        text.includes("$")
    ) {
        return "USD";
    }

    return "BYN";
}

function formatPrice(price, currency = "BYN") {
    if (
        price === null ||
        price === undefined ||
        !Number.isFinite(Number(price))
    ) {
        return "—";
    }

    const symbols = {
        BYN: "Br",
        RUB: "₽",
        USD: "$"
    };

    return `${Number(price).toLocaleString("ru-RU", {
        minimumFractionDigits: Number(price) % 1 ? 2 : 0,
        maximumFractionDigits: 2
    })} ${symbols[currency] || currency}`;
}

function inferCategoryFromTitle(title) {
    const text = normalizeText(title);

    const checks = [
        ["кроссов", "Обувь"],
        ["ботин", "Обувь"],
        ["туфл", "Обувь"],
        ["сандал", "Обувь"],
        ["футбол", "Футболки"],
        ["майк", "Футболки"],
        ["худи", "Худи"],
        ["толстов", "Худи"],
        ["свитшот", "Худи"],
        ["джинс", "Джинсы"],
        ["брюк", "Брюки"],
        ["штан", "Брюки"],
        ["куртк", "Куртки"],
        ["пухов", "Верхняя одежда"],
        ["пальто", "Верхняя одежда"],
        ["плать", "Платья"],
        ["юбк", "Юбки"],
        ["рубаш", "Рубашки"],
        ["сумк", "Сумки"],
        ["кошел", "Аксессуары"],
        ["кепк", "Аксессуары"],
        ["шапк", "Аксессуары"]
    ];

    for (const [needle, category] of checks) {
        if (text.includes(needle)) {
            return category;
        }
    }

    return "Одежда";
}

function normalizeCategory(value, product = null) {
    const raw = String(value ?? "").trim();

    if (!raw) {
        return inferCategoryFromTitle(
            product?.title || ""
        );
    }

    const normalized = normalizeText(raw);

    if (CATEGORY_ALIASES[normalized]) {
        return CATEGORY_ALIASES[normalized];
    }

    if (
        /^\d+$/.test(normalized) ||
        normalized.length > 40
    ) {
        return inferCategoryFromTitle(
            product?.title || ""
        );
    }

    return raw
        .replace(/\s+/g, " ")
        .replace(/^./, char => char.toUpperCase());
}

function normalizeProduct(raw, index = 0) {
    const sourceRaw =
        raw?.source ??
        raw?.marketplace ??
        raw?.platform ??
        "";

    const url =
        raw?.url ??
        raw?.link ??
        raw?.product_url ??
        "";

    const source = normalizeSource(
        sourceRaw || detectSource(url)
    );

    const title = String(
        raw?.title ??
        raw?.name ??
        raw?.product_name ??
        "Без названия"
    ).trim();

    let image =
        raw?.image ??
        raw?.image_url ??
        raw?.thumbnail ??
        "";

    if (
        !image &&
        Array.isArray(raw?.images) &&
        raw.images.length
    ) {
        image = raw.images[0];
    }

    if (
        image &&
        typeof image === "object"
    ) {
        image =
            image.url ??
            image.src ??
            image.link ??
            "";
    }

    const price = parsePrice(
        raw?.price ??
        raw?.current_price ??
        raw?.sale_price
    );

    const oldPrice = parsePrice(
        raw?.old_price ??
        raw?.oldPrice ??
        raw?.original_price
    );

    const currency = detectCurrency(
        raw?.currency ??
        raw?.price_currency ??
        raw?.price
    );

    const category = normalizeCategory(
        raw?.category ??
        raw?.category_name ??
        raw?.categoryName ??
        raw?.category_title ??
        "",
        {
            title
        }
    );

    const brand = String(
        raw?.brand ??
        raw?.brand_name ??
        ""
    ).trim();

    const rating = Number(
        raw?.rating ??
        raw?.stars ??
        0
    ) || 0;

    const id = String(
        raw?.id ??
        raw?.product_id ??
        raw?.external_id ??
        `${source}_${index}_${normalizeText(title)}`
    );

    return {
        id,
        external_id:
            raw?.external_id ??
            raw?.product_id ??
            null,

        title,
        brand,
        category,
        source,

        image:
            image ||
            "https://via.placeholder.com/800x1000?text=StyleFlow",

        images:
            Array.isArray(raw?.images)
                ? raw.images
                : image
                    ? [image]
                    : [],

        url: String(url || ""),
        price,
        oldPrice,
        currency,
        rating,

        raw
    };
}

function sanitizeActiveFilters() {
    if (!activeFilters || typeof activeFilters !== "object") {
        activeFilters = {
            minPrice: null,
            maxPrice: null,
            categories: [],
            sources: []
        };
    }

    activeFilters.categories = uniqueArray(
        activeFilters.categories
    );

    activeFilters.sources = uniqueArray(
        activeFilters.sources
    );

    if (
        activeFilters.minPrice !== null &&
        !Number.isFinite(Number(activeFilters.minPrice))
    ) {
        activeFilters.minPrice = null;
    }

    if (
        activeFilters.maxPrice !== null &&
        !Number.isFinite(Number(activeFilters.maxPrice))
    ) {
        activeFilters.maxPrice = null;
    }
}

sanitizeActiveFilters();

function getActiveFilterCount() {
    let count = 0;

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

    count += activeFilters.categories.length;
    count += activeFilters.sources.length;

    return count;
}

function updateFilterButton() {
    const button = document.getElementById("filterButton");
    const badge = document.getElementById("filterBadge");

    const count = getActiveFilterCount();

    if (button) {
        button.classList.toggle(
            "active",
            count > 0
        );
    }

    if (badge) {
        badge.textContent = count > 9
            ? "9+"
            : String(count);

        badge.classList.toggle(
            "show",
            count > 0
        );
    }
}

function openFilters() {
    const overlay =
        document.getElementById("filtersOverlay");

    if (!overlay) {
        return;
    }

    syncFilterUI();

    overlay.classList.add("show");
}

function closeFilters(event) {
    if (
        event &&
        event.target &&
        event.target.id !== "filtersOverlay"
    ) {
        return;
    }

    const overlay =
        document.getElementById("filtersOverlay");

    overlay?.classList.remove("show");
}

function toggleFilterChip(button) {
    if (!button) {
        return;
    }

    const container = button.parentElement;

    if (!container) {
        return;
    }

    const isAll =
        button.dataset.category === "__all__" ||
        button.dataset.source === "__all__";

    if (isAll) {
        container
            .querySelectorAll(".filter-chip")
            .forEach(chip => {
                chip.classList.remove("active");
            });

        button.classList.add("active");
        return;
    }

    const allButton =
        container.querySelector(
            '.filter-chip[data-category="__all__"], .filter-chip[data-source="__all__"]'
        );

    allButton?.classList.remove("active");

    button.classList.toggle("active");

    const selected =
        container.querySelectorAll(
            ".filter-chip.active"
        );

    if (!selected.length && allButton) {
        allButton.classList.add("active");
    }
}

function populateFilterCategories() {
    const container =
        document.getElementById("filterCategories");

    if (!container) {
        return;
    }

    const categories = new Map();

    for (const product of allProducts) {
        const category = normalizeCategory(
            product.category,
            product
        );

        if (!category) {
            continue;
        }

        const key = normalizeText(category);

        if (!categories.has(key)) {
            categories.set(key, category);
        }
    }

    const sortedCategories =
        [...categories.values()]
            .sort((a, b) =>
                a.localeCompare(
                    b,
                    "ru",
                    { sensitivity: "base" }
                )
            );

    activeFilters.categories =
        activeFilters.categories.filter(
            selected =>
                sortedCategories.some(
                    category =>
                        normalizeText(category) ===
                        normalizeText(selected)
                )
        );

    container.innerHTML = "";

    const allButton =
        document.createElement("button");

    allButton.type = "button";
    allButton.className = "filter-chip";
    allButton.dataset.category = "__all__";
    allButton.textContent = "Все";

    allButton.onclick = function () {
        toggleFilterChip(this);
    };

    container.appendChild(allButton);

    for (const category of sortedCategories) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "filter-chip";
        button.dataset.category = category;
        button.textContent = category;

        button.onclick = function () {
            toggleFilterChip(this);
        };

        container.appendChild(button);
    }

    syncCategoryFilterUI();
}

function populateFilterSources() {
    const container =
        document.getElementById("filterSources");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const allButton =
        document.createElement("button");

    allButton.type = "button";
    allButton.className = "filter-chip";
    allButton.dataset.source = "__all__";
    allButton.textContent = "Все";

    allButton.onclick = function () {
        toggleFilterChip(this);
    };

    container.appendChild(allButton);

    for (const source of SOURCE_LIST) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "filter-chip";
        button.dataset.source = source.value;
        button.textContent = source.label;

        button.onclick = function () {
            toggleFilterChip(this);
        };

        container.appendChild(button);
    }

    syncSourceFilterUI();
}

function syncCategoryFilterUI() {
    const container =
        document.getElementById("filterCategories");

    if (!container) {
        return;
    }

    const chips =
        container.querySelectorAll(
            ".filter-chip"
        );

    let activeCount = 0;

    chips.forEach(chip => {
        const category =
            chip.dataset.category;

        if (category === "__all__") {
            return;
        }

        const selected =
            activeFilters.categories.some(
                value =>
                    normalizeText(value) ===
                    normalizeText(category)
            );

        chip.classList.toggle(
            "active",
            selected
        );

        if (selected) {
            activeCount++;
        }
    });

    const all =
        container.querySelector(
            '.filter-chip[data-category="__all__"]'
        );

    all?.classList.toggle(
        "active",
        activeCount === 0
    );
}

function syncSourceFilterUI() {
    const container =
        document.getElementById("filterSources");

    if (!container) {
        return;
    }

    const chips =
        container.querySelectorAll(
            ".filter-chip"
        );

    let activeCount = 0;

    chips.forEach(chip => {
        const source =
            chip.dataset.source;

        if (source === "__all__") {
            return;
        }

        const selected =
            activeFilters.sources.some(
                value =>
                    normalizeSource(value) ===
                    normalizeSource(source)
            );

        chip.classList.toggle(
            "active",
            selected
        );

        if (selected) {
            activeCount++;
        }
    });

    const all =
        container.querySelector(
            '.filter-chip[data-source="__all__"]'
        );

    all?.classList.toggle(
        "active",
        activeCount === 0
    );
}

function syncFilterUI() {
    sanitizeActiveFilters();

    const min =
        document.getElementById("filterMinPrice");

    const max =
        document.getElementById("filterMaxPrice");

    if (min) {
        min.value =
            activeFilters.minPrice ?? "";
    }

    if (max) {
        max.value =
            activeFilters.maxPrice ?? "";
    }

    populateFilterCategories();
    populateFilterSources();

    updateFilterButton();
}

function resetFilters() {
    activeFilters = {
        minPrice: null,
        maxPrice: null,
        categories: [],
        sources: []
    };

    saveJSON(
        "styleflow_filters",
        activeFilters
    );

    syncFilterUI();

    buildPersonalizedFeed();

    closeFilters();

    showToast("Фильтры сброшены");
}

function applyFilters() {
    const minInput =
        document.getElementById("filterMinPrice");

    const maxInput =
        document.getElementById("filterMaxPrice");

    let minPrice =
        parsePrice(minInput?.value);

    let maxPrice =
        parsePrice(maxInput?.value);

    if (
        minPrice !== null &&
        maxPrice !== null &&
        minPrice > maxPrice
    ) {
        [minPrice, maxPrice] =
            [maxPrice, minPrice];
    }

    const categoryChips =
        document.querySelectorAll(
            "#filterCategories .filter-chip.active"
        );

    const sourceChips =
        document.querySelectorAll(
            "#filterSources .filter-chip.active"
        );

    const categories = [];

    categoryChips.forEach(chip => {
        const value =
            chip.dataset.category;

        if (
            value &&
            value !== "__all__"
        ) {
            categories.push(value);
        }
    });

    const sources = [];

    sourceChips.forEach(chip => {
        const value =
            chip.dataset.source;

        if (
            value &&
            value !== "__all__"
        ) {
            sources.push(
                normalizeSource(value)
            );
        }
    });

    activeFilters = {
        minPrice,
        maxPrice,
        categories: uniqueArray(categories),
        sources: uniqueArray(sources)
    };

    saveJSON(
        "styleflow_filters",
        activeFilters
    );

    currentIndex = 0;

    buildPersonalizedFeed();

    updateFilterButton();

    closeFilters();

    const resultCount =
        applyProductFilters(allProducts).length;

    if (!resultCount) {
        showToast(
            "По этим фильтрам товаров нет"
        );
    } else {
        showToast(
            `Найдено товаров: ${resultCount}`
        );
    }
}

function applyProductFilters(source) {
    if (!Array.isArray(source)) {
        return [];
    }

    return source.filter(product => {
        const price =
            Number(product.price);

        if (
            activeFilters.minPrice !== null &&
            (
                !Number.isFinite(price) ||
                price < Number(activeFilters.minPrice)
            )
        ) {
            return false;
        }

        if (
            activeFilters.maxPrice !== null &&
            (
                !Number.isFinite(price) ||
                price > Number(activeFilters.maxPrice)
            )
        ) {
            return false;
        }

        if (
            activeFilters.categories.length
        ) {
            const productCategory =
                normalizeText(
                    normalizeCategory(
                        product.category,
                        product
                    )
                );

            const matchesCategory =
                activeFilters.categories.some(
                    category =>
                        productCategory ===
                        normalizeText(category)
                );

            if (!matchesCategory) {
                return false;
            }
        }

        if (
            activeFilters.sources.length
        ) {
            const productSource =
                normalizeSource(
                    product.source
                );

            const matchesSource =
                activeFilters.sources.some(
                    source =>
                        productSource ===
                        normalizeSource(source)
                );

            if (!matchesSource) {
                return false;
            }
        }

        return true;
    });
}

async function loadUserHistory() {
    if (!telegramUserId) {
        return;
    }

    try {
        const response =
            await fetch(
                `/api/user/history?user_id=${encodeURIComponent(
                    telegramUserId
                )}`
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        if (data?.status !== "ok") {
            return;
        }

        if (Array.isArray(data.viewed)) {
            viewedProducts =
                mergeUniqueIds(
                    viewedProducts,
                    data.viewed
                ).slice(-500);

            saveJSON(
                "styleflow_viewed",
                viewedProducts
            );
        }

        if (Array.isArray(data.opened)) {
            openedProducts =
                mergeIds(
                    openedProducts,
                    data.opened
                ).slice(-500);

            saveJSON(
                "styleflow_opened",
                openedProducts
            );
        }

        userHistoryLoaded = true;
    } catch {
        // local history remains usable
    }
}

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

    try {
        await fetch(
            `/api/user/${action}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: telegramUserId,
                    product_id: String(productId)
                })
            }
        );
    } catch {
        // local state remains source of truth on failure
    }
}

function registerView(product) {
    if (!product) {
        return;
    }

    const id =
        getProductId(product);

    if (!id) {
        return;
    }

    if (!viewedProducts.includes(id)) {
        viewedProducts.push(id);

        if (viewedProducts.length > 500) {
            viewedProducts =
                viewedProducts.slice(-500);
        }

        saveJSON(
            "styleflow_viewed",
            viewedProducts
        );

        syncUserAction(
            "view",
            id
        );
    }

    updateProfile();
}

function registerOpen(product) {
    if (!product) {
        return;
    }

    const id =
        getProductId(product);

    if (!id) {
        return;
    }

    openedProducts.push(id);

    if (openedProducts.length > 500) {
        openedProducts =
            openedProducts.slice(-500);
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
}

function rebuildFeedAfterSignal() {
    const currentId =
        getProductId(currentProduct);

    buildPersonalizedFeed();

    if (
        currentId &&
        products.length
    ) {
        const index =
            products.findIndex(
                product =>
                    getProductId(product) ===
                    currentId
            );

        if (index >= 0) {
            currentIndex = index;
            renderCurrentProduct();
        }
    }
}

function getSignalCount() {
    return (
        viewedProducts.length +
        openedProducts.length +
        favorites.length
    );
}

function getPersonalizationStrength() {
    const count =
        getSignalCount();

    if (count <= PERSONALIZATION_START) {
        return 0;
    }

    return Math.min(
        1,
        (
            count - PERSONALIZATION_START
        ) /
        (
            PERSONALIZATION_FULL -
            PERSONALIZATION_START
        )
    );
}

function buildUserProfile() {
    const profile = {
        categories: {},
        brands: {},
        sources: {},
        prices: [],
        totalSignals: 0
    };

    function addSignal(
        product,
        weight
    ) {
        if (!product) {
            return;
        }

        const category =
            normalizeCategory(
                product.category,
                product
            );

        const brand =
            normalizeText(
                product.brand
            );

        const source =
            normalizeSource(
                product.source
            );

        if (category) {
            profile.categories[category] =
                (
                    profile.categories[category] ||
                    0
                ) + weight;
        }

        if (brand) {
            profile.brands[brand] =
                (
                    profile.brands[brand] ||
                    0
                ) + weight;
        }

        if (source) {
            profile.sources[source] =
                (
                    profile.sources[source] ||
                    0
                ) + weight;
        }

        if (
            Number.isFinite(
                Number(product.price)
            )
        ) {
            profile.prices.push({
                value: Number(product.price),
                weight
            });
        }

        profile.totalSignals += weight;
    }

    for (const id of viewedProducts) {
        const product =
            findProductById(id);

        if (product) {
            addSignal(product, 1);
        }
    }

    for (const id of openedProducts) {
        const product =
            findProductById(id);

        if (product) {
            addSignal(product, 3);
        }
    }

    for (const id of favorites) {
        const product =
            findProductById(id);

        if (product) {
            addSignal(product, 6);
        }
    }

    return profile;
}

function weightedAveragePrice(
    profile
) {
    if (!profile.prices.length) {
        return null;
    }

    let total = 0;
    let weight = 0;

    for (const item of profile.prices) {
        total += item.value * item.weight;
        weight += item.weight;
    }

    return weight
        ? total / weight
        : null;
}

function scoreProduct(
    product,
    profile
) {
    let score = 0;

    const category =
        normalizeCategory(
            product.category,
            product
        );

    const categoryKey =
        Object.keys(
            profile.categories
        ).find(
            key =>
                normalizeText(key) ===
                normalizeText(category)
        );

    if (categoryKey) {
        score +=
            profile.categories[categoryKey] *
            5;
    }

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

    const source =
        normalizeSource(
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

    const averagePrice =
        weightedAveragePrice(
            profile
        );

    if (
        averagePrice !== null &&
        Number.isFinite(
            Number(product.price)
        )
    ) {
        const price =
            Number(product.price);

        const difference =
            Math.abs(
                price - averagePrice
            ) /
            Math.max(
                averagePrice,
                1
            );

        if (difference <= 0.10) {
            score += 12;
        } else if (difference <= 0.25) {
            score += 7;
        } else if (difference <= 0.50) {
            score += 3;
        }
    }

    score += Math.random() * 4;

    return score;
}

function shuffle(array) {
    const result =
        [...array];

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];
    }

    return result;
}

function buildDiverseFeed(
    candidates,
    profile,
    strength
) {
    if (!candidates.length) {
        return [];
    }

    const scored =
        candidates.map(
            product => ({
                product,
                score:
                    scoreProduct(
                        product,
                        profile
                    )
            })
        );

    scored.sort(
        (a, b) =>
            b.score - a.score
    );

    const randomRatio =
        MIN_RANDOM_RATIO +
        (
            MAX_RANDOM_RATIO -
            MIN_RANDOM_RATIO
        ) *
        (1 - strength);

    const randomCount =
        Math.floor(
            scored.length *
            randomRatio
        );

    const randomProducts =
        shuffle(
            scored
                .slice()
                .sort(
                    () => Math.random() - .5
                )
        )
            .slice(0, randomCount)
            .map(item => item.product);

    const randomIds =
        new Set(
            randomProducts.map(
                getProductId
            )
        );

    const personalizedProducts =
        scored
            .filter(
                item =>
                    !randomIds.has(
                        getProductId(
                            item.product
                        )
                    )
            )
            .map(
                item => item.product
            );

    let pool =
        shuffle(randomProducts);

    pool.push(
        ...personalizedProducts
    );

    const result = [];

    let previousCategory = "";
    let previousSource = "";
    let categoryStreak = 0;
    let sourceStreak = 0;

    while (pool.length) {
        let selectedIndex = -1;

        for (
            let i = 0;
            i < pool.length;
            i++
        ) {
            const item =
                pool[i];

            const category =
                normalizeText(
                    normalizeCategory(
                        item.category,
                        item
                    )
                );

            const source =
                normalizeSource(
                    item.source
                );

            const categoryBlocked =
                category &&
                category === previousCategory &&
                categoryStreak >=
                    MAX_SAME_CATEGORY_STREAK;

            const sourceBlocked =
                source &&
                source === previousSource &&
                sourceStreak >=
                    MAX_SAME_SOURCE_STREAK;

            if (
                !categoryBlocked &&
                !sourceBlocked
            ) {
                selectedIndex = i;
                break;
            }
        }

        if (selectedIndex < 0) {
            selectedIndex = 0;
        }

        const [selected] =
            pool.splice(
                selectedIndex,
                1
            );

        result.push(selected);

        const category =
            normalizeText(
                normalizeCategory(
                    selected.category,
                    selected
                )
            );

        const source =
            normalizeSource(
                selected.source
            );

        if (
            category === previousCategory
        ) {
            categoryStreak++;
        } else {
            previousCategory =
                category;
            categoryStreak = 1;
        }

        if (
            source === previousSource
        ) {
            sourceStreak++;
        } else {
            previousSource =
                source;
            sourceStreak = 1;
        }
    }

    return result;
}

function buildPersonalizedFeed() {
    const filtered =
        applyProductFilters(
            allProducts
        );

    const viewedSet =
        new Set(
            viewedProducts.map(String)
        );

    const unseen =
        filtered.filter(
            product =>
                !viewedSet.has(
                    getProductId(product)
                )
        );

    if (!unseen.length) {
        products = [];
        currentIndex = 0;
        currentProduct = null;
        showEmptyFeed();
        return;
    }

    const profile =
        buildUserProfile();

    const strength =
        getPersonalizationStrength();

    products =
        strength === 0
            ? buildDiverseFeed(
                unseen,
                profile,
                0
            )
            : buildDiverseFeed(
                unseen,
                profile,
                strength
            );

    currentIndex = 0;

    hideEmptyFeed();
    renderCurrentProduct();
}

function findProductById(id) {
    const wanted =
        String(id);

    return allProducts.find(
        product =>
            getProductId(product) ===
            wanted
    );
}

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
                `HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        const rawProducts =
            Array.isArray(data)
                ? data
                : Array.isArray(data?.products)
                    ? data.products
                    : Array.isArray(data?.items)
                        ? data.items
                        : Array.isArray(data?.data)
                            ? data.data
                            : [];

        allProducts =
            rawProducts.map(
                (product, index) =>
                    normalizeProduct(
                        product,
                        index
                    )
            );

        saveJSON(
            "styleflow_main_feed",
            allProducts
        );

        populateFilterCategories();
        populateFilterSources();

        buildPersonalizedFeed();
    } catch (error) {
        console.error(
            "STYLEFLOW feed error:",
            error
        );

        const cached =
            loadJSON(
                "styleflow_main_feed",
                []
            );

        allProducts =
            Array.isArray(cached)
                ? cached.map(
                    (product, index) =>
                        normalizeProduct(
                            product,
                            index
                        )
                )
                : [];

        populateFilterCategories();
        populateFilterSources();

        buildPersonalizedFeed();

        if (!allProducts.length) {
            showEmptyFeed();
        }
    }
}

function showEmptyFeed() {
    const card =
        document.getElementById(
            "productCard"
        );

    const empty =
        document.getElementById(
            "feedEmpty"
        );

    if (card) {
        card.style.display = "none";
    }

    if (empty) {
        empty.style.display = "flex";
    }
}

function hideEmptyFeed() {
    const card =
        document.getElementById(
            "productCard"
        );

    const empty =
        document.getElementById(
            "feedEmpty"
        );

    if (card) {
        card.style.display = "";
    }

    if (empty) {
        empty.style.display = "none";
    }
}

function renderCurrentProduct() {
    if (
        !products.length ||
        currentIndex < 0 ||
        currentIndex >= products.length
    ) {
        showEmptyFeed();
        return;
    }

    const product =
        products[currentIndex];

    currentProduct = product;

    hideEmptyFeed();

    const image =
        document.getElementById(
            "productImage"
        );

    const source =
        document.getElementById(
            "productSource"
        );

    const brand =
        document.getElementById(
            "productBrand"
        );

    const title =
        document.getElementById(
            "productTitle"
        );

    const rating =
        document.getElementById(
            "productRating"
        );

    const category =
        document.getElementById(
            "productCategory"
        );

    const price =
        document.getElementById(
            "productPrice"
        );

    const oldPrice =
        document.getElementById(
            "productOldPrice"
        );

    if (image) {
        image.src =
            product.image;

        image.alt =
            product.title;
    }

    if (source) {
        source.textContent =
            sourceLabel(
                product.source
            );
    }

    if (brand) {
        brand.textContent =
            product.brand || "";
        brand.style.display =
            product.brand
                ? ""
                : "none";
    }

    if (title) {
        title.textContent =
            product.title;
    }

    if (rating) {
        rating.textContent =
            product.rating
                ? `★ ${product.rating}`
                : "";
    }

    if (category) {
        category.textContent =
            normalizeCategory(
                product.category,
                product
            );
    }

    if (price) {
        price.textContent =
            formatPrice(
                product.price,
                product.currency
            );
    }

    if (oldPrice) {
        oldPrice.textContent =
            product.oldPrice &&
            product.oldPrice >
                product.price
                ? formatPrice(
                    product.oldPrice,
                    product.currency
                )
                : "";
    }

    updateLikeButton();

    registerView(product);
}

function showProduct(index) {
    if (
        !products.length
    ) {
        showEmptyFeed();
        return;
    }

    if (
        index < 0 ||
        index >= products.length
    ) {
        return;
    }

    currentIndex = index;

    renderCurrentProduct();
}

function nextProduct() {
    if (!products.length) {
        return;
    }

    if (
        currentIndex <
        products.length - 1
    ) {
        currentIndex++;
        renderCurrentProduct();
        return;
    }

    showToast(
        "Ты просмотрел всю доступную ленту"
    );

    showEmptyFeed();
}

function previousProduct() {
    if (!products.length) {
        return;
    }

    if (currentIndex > 0) {
        currentIndex--;
        renderCurrentProduct();
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

    card.addEventListener(
        "touchstart",
        event => {
            if (
                event.touches.length !== 1
            ) {
                return;
            }

            touchStartX =
                event.touches[0].clientX;

            touchStartY =
                event.touches[0].clientY;

            isDragging = true;

            card.classList.add(
                "dragging"
            );
        },
        { passive: true }
    );

    card.addEventListener(
        "touchmove",
        event => {
            if (!isDragging) {
                return;
            }

            const x =
                event.touches[0].clientX;

            const y =
                event.touches[0].clientY;

            const dx =
                x - touchStartX;

            const dy =
                y - touchStartY;

            if (
                Math.abs(dx) <
                Math.abs(dy)
            ) {
                return;
            }

            card.style.transform =
                `translateX(${dx}px) rotate(${dx / 18}deg)`;
        },
        { passive: true }
    );

    card.addEventListener(
        "touchend",
        event => {
            if (!isDragging) {
                return;
            }

            isDragging = false;

            card.classList.remove(
                "dragging"
            );

            const touch =
                event.changedTouches[0];

            const dx =
                touch.clientX -
                touchStartX;

            const dy =
                touch.clientY -
                touchStartY;

            card.style.transform = "";

            if (
                Math.abs(dy) >
                Math.abs(dx) &&
                Math.abs(dy) > 70
            ) {
                if (dy < 0) {
                    nextProduct();
                } else {
                    previousProduct();
                }

                return;
            }

            if (
                Math.abs(dx) > 90
            ) {
                if (dx < 0) {
                    nextProduct();
                } else {
                    previousProduct();
                }
            }
        },
        { passive: true }
    );

    card.addEventListener(
        "dblclick",
        () => {
            toggleLike();
        }
    );
}

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
            clearTimeout(
                searchTimer
            );

            searchTimer =
                setTimeout(
                    () =>
                        performSearch(
                            input.value
                        ),
                    180
                );
        }
    );
}

function quickSearch(query) {
    switchTab("search");

    const input =
        document.getElementById(
            "searchInput"
        );

    if (!input) {
        return;
    }

    input.value = query;

    performSearch(query);

    input.focus();
}

function clearSearch() {
    const input =
        document.getElementById(
            "searchInput"
        );

    if (input) {
        input.value = "";
    }

    performSearch("");

    input?.focus();
}

function performSearch(query) {
    const text =
        normalizeText(query);

    const home =
        document.getElementById(
            "searchHome"
        );

    const results =
        document.getElementById(
            "searchResults"
        );

    const list =
        document.getElementById(
            "resultList"
        );

    const count =
        document.getElementById(
            "resultCount"
        );

    const clear =
        document.getElementById(
            "searchClear"
        );

    if (!text) {
        home?.style &&
            (home.style.display = "");

        results?.classList.remove(
            "active"
        );

        if (clear) {
            clear.style.display =
                "none";
        }

        return;
    }

    if (home?.style) {
        home.style.display =
            "none";
    }

    if (clear) {
        clear.style.display =
            "flex";
    }

    const found =
        allProducts.filter(
            product => {
                const haystack =
                    normalizeText(
                        [
                            product.title,
                            product.brand,
                            product.category,
                            product.source
                        ].join(" ")
                    );

                return haystack.includes(
                    text
                );
            }
        );

    if (count) {
        count.textContent =
            `Найдено: ${found.length}`;
    }

    if (list) {
        list.innerHTML = "";

        found
            .slice(0, 100)
            .forEach(product => {
                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "result-card";

                card.innerHTML = `
                    <img
                        class="result-image"
                        src="${escapeHtml(product.image)}"
                        alt=""
                    >

                    <div class="result-info">
                        <div class="result-brand">
                            ${escapeHtml(product.brand || sourceLabel(product.source))}
                        </div>

                        <div class="result-title">
                            ${escapeHtml(product.title)}
                        </div>

                        <div class="result-price">
                            ${escapeHtml(
                                formatPrice(
                                    product.price,
                                    product.currency
                                )
                            )}
                        </div>
                    </div>
                `;

                card.onclick =
                    () =>
                        openProductFromObject(
                            product
                        );

                list.appendChild(card);
            });
    }

    results?.classList.add(
        "active"
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openProductFromObject(product) {
    if (!product) {
        return;
    }

    const id =
        getProductId(product);

    const index =
        products.findIndex(
            item =>
                getProductId(item) === id
        );

    if (index >= 0) {
        switchTab("feed");
        currentIndex = index;
        renderCurrentProduct();
        return;
    }

    currentProduct = product;

    const oldProducts =
        products;

    products = [product];
    currentIndex = 0;

    switchTab("feed");

    renderCurrentProduct();

    products = oldProducts;
}

function openCurrentProduct() {
    if (
        !currentProduct ||
        !currentProduct.url
    ) {
        showToast(
            "Ссылка на товар недоступна"
        );
        return;
    }

    registerOpen(
        currentProduct
    );

    try {
        if (
            window.Telegram?.WebApp?.openLink
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
    } catch {
        window.open(
            currentProduct.url,
            "_blank"
        );
    }
}

function toggleLike() {
    if (!currentProduct) {
        return;
    }

    const id =
        getProductId(
            currentProduct
        );

    if (!id) {
        return;
    }

    const index =
        favorites.indexOf(id);

    if (index >= 0) {
        favorites.splice(
            index,
            1
        );

        showToast(
            "Убрано из избранного"
        );
    } else {
        favorites.push(id);

        const heart =
            document.getElementById(
                "bigHeart"
            );

        heart?.classList.remove(
            "show"
        );

        void heart?.offsetWidth;

        heart?.classList.add(
            "show"
        );

        showToast(
            "Добавлено в избранное ❤️"
        );
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
        document.getElementById(
            "likeButton"
        );

    if (!button || !currentProduct) {
        return;
    }

    const liked =
        favorites.includes(
            getProductId(
                currentProduct
            )
        );

    button.classList.toggle(
        "liked",
        liked
    );
}

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

    const favoriteProducts =
        favorites
            .map(findProductById)
            .filter(Boolean);

    empty.style.display =
        favoriteProducts.length
            ? "none"
            : "flex";

    for (const product of favoriteProducts) {
        const card =
            document.createElement(
                "div"
            );

        card.className =
            "favorite-card";

        card.innerHTML = `
            <img
                src="${escapeHtml(product.image)}"
                alt=""
            >

            <div class="favorite-info">
                <div class="favorite-title">
                    ${escapeHtml(product.title)}
                </div>

                <div class="favorite-price">
                    ${escapeHtml(
                        formatPrice(
                            product.price,
                            product.currency
                        )
                    )}
                </div>
            </div>
        `;

        card.onclick =
            () =>
                openProductFromObject(
                    product
                );

        grid.appendChild(card);
    }
}

function renderRecent() {
    const grid =
        document.getElementById(
            "recentGrid"
        );

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    const recentIds =
        viewedProducts
            .slice()
            .reverse()
            .slice(0, 10);

    for (const id of recentIds) {
        const product =
            findProductById(id);

        if (!product) {
            continue;
        }

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "recent-card";

        card.innerHTML = `
            <img
                src="${escapeHtml(product.image)}"
                alt=""
            >

            <div class="recent-price">
                ${escapeHtml(
                    formatPrice(
                        product.price,
                        product.currency
                    )
                )}
            </div>
        `;

        card.onclick =
            () =>
                openProductFromObject(
                    product
                );

        grid.appendChild(card);
    }
}

function updateProfile() {
    const liked =
        document.getElementById(
            "likedCount"
        );

    const viewed =
        document.getElementById(
            "viewedCount"
        );

    const opened =
        document.getElementById(
            "openedCount"
        );

    const collection =
        document.getElementById(
            "collectionCount"
        );

    if (liked) {
        liked.textContent =
            favorites.length;
    }

    if (viewed) {
        viewed.textContent =
            viewedProducts.length;
    }

    if (opened) {
        opened.textContent =
            openedProducts.length;
    }

    if (collection) {
        const count =
            favorites.length;

        collection.textContent =
            `${count} ${
                count === 1
                    ? "товар"
                    : "товаров"
            }`;
    }

    renderFavorites();
    renderRecent();

    updateTelegramProfile();
}

function updateTelegramProfile() {
    const tg =
        window.Telegram?.WebApp;

    const name =
        document.getElementById(
            "profileName"
        );

    const avatar =
        document.getElementById(
            "profileAvatar"
        );

    if (!tg?.initDataUnsafe?.user) {
        return;
    }

    const user =
        tg.initDataUnsafe.user;

    const fullName =
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ");

    if (name) {
        name.textContent =
            fullName ||
            user.username ||
            "Style Explorer";
    }

    if (avatar) {
        avatar.textContent =
            (
                user.first_name ||
                user.username ||
                "S"
            )
                .charAt(0)
                .toUpperCase();
    }
}

function openCollection(name) {
    if (
        name === "favorites"
    ) {
        switchTab(
            "favorites"
        );
    }
}

function switchTab(tab) {
    currentTab = tab;

    const screens = {
        feed:
            document.getElementById(
                "feedScreen"
            ),
        favorites:
            document.getElementById(
                "favoritesScreen"
            ),
        search:
            document.getElementById(
                "searchScreen"
            ),
        profile:
            document.getElementById(
                "profileScreen"
            )
    };

    Object.entries(
        screens
    ).forEach(
        ([name, screen]) => {
            screen?.classList.toggle(
                "active",
                name === tab
            );
        }
    );

    const navs = {
        feed:
            document.getElementById(
                "navFeed"
            ),
        favorites:
            document.getElementById(
                "navFavorites"
            ),
        search:
            document.getElementById(
                "navSearch"
            ),
        profile:
            document.getElementById(
                "navProfile"
            )
    };

    Object.entries(
        navs
    ).forEach(
        ([name, nav]) => {
            nav?.classList.toggle(
                "active",
                name === tab
            );
        }
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
}

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

    list.innerHTML = `
        <div class="comment">
            <div class="comment-user">
                Отзывы
            </div>

            <div class="comment-text">
                Отзывы для этого товара пока не подключены.
            </div>
        </div>
    `;

    overlay.classList.add(
        "show"
    );
}

function closeComments(event) {
    if (
        event &&
        event.target &&
        event.target.id !==
            "commentsOverlay"
    ) {
        return;
    }

    document
        .getElementById(
            "commentsOverlay"
        )
        ?.classList.remove(
            "show"
        );
}

function shareCurrentProduct() {
    if (!currentProduct) {
        return;
    }

    const url =
        currentProduct.url;

    if (!url) {
        showToast(
            "Ссылка на товар недоступна"
        );
        return;
    }

    const text =
        `${currentProduct.title}\n${formatPrice(
            currentProduct.price,
            currentProduct.currency
        )}`;

    const tg =
        window.Telegram?.WebApp;

    if (
        tg?.openTelegramLink
    ) {
        const shareUrl =
            "https://t.me/share/url" +
            `?url=${encodeURIComponent(url)}` +
            `&text=${encodeURIComponent(text)}`;

        tg.openTelegramLink(
            shareUrl
        );

        return;
    }

    if (
        navigator.share
    ) {
        navigator.share({
            title:
                currentProduct.title,
            text,
            url
        }).catch(() => {});
        return;
    }

    navigator.clipboard
        ?.writeText(url)
        .then(
            () =>
                showToast(
                    "Ссылка скопирована"
                )
        )
        .catch(
            () =>
                showToast(
                    "Не удалось скопировать ссылку"
                )
        );
}

function showToast(message) {
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
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () =>
                toast.classList.remove(
                    "show"
                ),
            1800
        );
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        try {
            const tg =
                window.Telegram?.WebApp;

            tg?.ready();
            tg?.expand();

            try {
                tg?.setHeaderColor(
                    "#09090d"
                );

                tg?.setBackgroundColor(
                    "#09090d"
                );
            } catch {
                // ignore
            }
        } catch {
            // ignore
        }

        setupSearch();
        setupSwipe();

        telegramUserId =
            getTelegramUserId();

        await loadUserHistory();
        await loadFeed();

        updateProfile();
        updateFilterButton();
    }
);
