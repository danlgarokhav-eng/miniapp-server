<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    >

    <title>StyleFlow</title>

    <script src="https://telegram.org/js/telegram-web-app.js"></script>

    <style>
        * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #09090d;
            color: white;
            font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;
        }

        button,
        input {
            font: inherit;
        }

        button {
            border: 0;
            color: inherit;
        }

        /* =========================
           BACKGROUND
        ========================= */

        .background {
            position: fixed;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            background:
                radial-gradient(
                    circle at 50% 0%,
                    rgba(120, 80, 255, .12),
                    transparent 40%
                ),
                #09090d;
        }

        .blob {
            position: absolute;
            width: 280px;
            height: 280px;
            border-radius: 50%;
            filter: blur(90px);
            opacity: .16;
            animation: floatBlob 12s infinite alternate ease-in-out;
        }

        .blob.one {
            top: -100px;
            left: -80px;
            background: #8b5cf6;
        }

        .blob.two {
            right: -100px;
            top: 30%;
            background: #ec4899;
            animation-delay: -4s;
        }

        .blob.three {
            bottom: -120px;
            left: 20%;
            background: #3b82f6;
            animation-delay: -8s;
        }

        @keyframes floatBlob {
            from {
                transform: translate(0, 0) scale(1);
            }

            to {
                transform: translate(40px, -30px) scale(1.15);
            }
        }

        /* =========================
           APP
        ========================= */

        #app {
            position: relative;
            width: 100%;
            height: 100%;
        }

        .screen {
            position: absolute;
            inset: 0;
            display: none;
            overflow: hidden;
        }

        .screen.active {
            display: block;
        }

        /* =========================
           TOP BAR
        ========================= */

        .topbar {
            position: absolute;
            z-index: 20;
            top: 0;
            left: 0;
            right: 0;

            height: 70px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            padding: 0 18px;

            background: linear-gradient(
                to bottom,
                rgba(9, 9, 13, .72),
                transparent
            );

            backdrop-filter: blur(8px);
        }

        .logo {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -.7px;
        }

        .logo span {
            opacity: .45;
        }

        .top-search {
            width: 42px;
            height: 42px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background: rgba(255,255,255,.1);
            backdrop-filter: blur(15px);

            cursor: pointer;
            font-size: 18px;
        }

        /* =========================
           FEED
        ========================= */

        .feed-screen {
            width: 100%;
            height: 100%;
        }

        .feed {
            width: 100%;
            height: 100%;

            display: flex;
            align-items: center;
            justify-content: center;

            padding:
                74px
                12px
                82px;
        }

        .card {
            position: relative;

            width: min(470px, 100%);
            height: min(760px, calc(100vh - 155px));

            min-height: 520px;

            overflow: hidden;

            border-radius: 28px;

            background: #15151b;

            box-shadow:
                0 30px 80px rgba(0,0,0,.5),
                0 0 0 1px rgba(255,255,255,.06);

            user-select: none;

            transform-origin: center;
            transition:
                transform .25s ease,
                opacity .25s ease;
        }

        .card.dragging {
            transition: none;
        }

        .product-media {
            position: absolute;
            inset: 0;

            background: #18181f;
        }

        .product-media::after {
            content: "";

            position: absolute;
            inset: 0;

            background:
                linear-gradient(
                    to bottom,
                    rgba(0,0,0,.08),
                    transparent 35%,
                    rgba(0,0,0,.82) 100%
                );
        }

        .product-media img {
            width: 100%;
            height: 100%;

            display: block;

            object-fit: cover;

            pointer-events: none;
        }

        .product-info {
            position: absolute;
            z-index: 3;

            left: 20px;
            right: 82px;
            bottom: 22px;
        }

        .source-badge {
            display: inline-flex;

            padding: 6px 10px;

            margin-bottom: 10px;

            border-radius: 999px;

            background: rgba(0,0,0,.45);
            backdrop-filter: blur(12px);

            font-size: 11px;
            font-weight: 700;

            color: rgba(255,255,255,.9);
        }

        .brand {
            margin-bottom: 5px;

            font-size: 13px;
            font-weight: 700;

            color: rgba(255,255,255,.65);
        }

        .title {
            margin: 0;

            font-size: 20px;
            line-height: 1.18;
            font-weight: 750;

            text-shadow: 0 2px 12px rgba(0,0,0,.4);
        }

        .meta {
            display: flex;
            align-items: center;
            gap: 8px;

            margin-top: 10px;

            font-size: 13px;
            color: rgba(255,255,255,.82);
        }

        .rating {
            color: #ffd75a;
        }

        .price {
            margin-top: 9px;

            font-size: 25px;
            font-weight: 850;
        }

        .old-price {
            margin-left: 7px;

            font-size: 13px;
            font-weight: 500;

            color: rgba(255,255,255,.45);
            text-decoration: line-through;
        }

        .open-product {
            margin-top: 14px;

            display: inline-flex;
            align-items: center;
            gap: 7px;

            padding: 11px 16px;

            border-radius: 14px;

            background: rgba(255,255,255,.95);
            color: #101014;

            font-size: 13px;
            font-weight: 800;

            cursor: pointer;
        }

        /* =========================
           ACTIONS
        ========================= */

        .actions {
            position: absolute;
            z-index: 10;

            right: 12px;
            bottom: 24px;

            display: flex;
            flex-direction: column;
            align-items: center;

            gap: 16px;
        }

        .action {
            display: flex;
            flex-direction: column;
            align-items: center;

            gap: 4px;

            background: none;

            cursor: pointer;
        }

        .action-icon {
            width: 48px;
            height: 48px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background: rgba(0,0,0,.4);
            backdrop-filter: blur(15px);

            font-size: 21px;

            transition:
                transform .15s ease,
                background .15s ease;
        }

        .action:active .action-icon {
            transform: scale(.86);
        }

        .action.liked .action-icon {
            color: #ff426d;
            background: rgba(255,66,109,.18);
        }

        .action-label {
            font-size: 10px;
            font-weight: 600;

            color: rgba(255,255,255,.82);
        }

        /* =========================
           BIG HEART
        ========================= */

        .big-heart {
            position: absolute;
            z-index: 30;

            left: 50%;
            top: 50%;

            transform:
                translate(-50%, -50%)
                scale(.3);

            opacity: 0;

            font-size: 100px;

            pointer-events: none;

            text-shadow:
                0 15px 40px rgba(0,0,0,.4);

            transition: none;
        }

        .big-heart.show {
            animation: heartPop .8s ease forwards;
        }

        @keyframes heartPop {
            0% {
                opacity: 0;
                transform:
                    translate(-50%, -50%)
                    scale(.3);
            }

            25% {
                opacity: 1;
                transform:
                    translate(-50%, -50%)
                    scale(1.15);
            }

            60% {
                opacity: 1;
                transform:
                    translate(-50%, -50%)
                    scale(1);
            }

            100% {
                opacity: 0;
                transform:
                    translate(-50%, -50%)
                    scale(1.4);
            }
        }

        /* =========================
           EMPTY
        ========================= */

        .empty {
            position: absolute;
            inset: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            text-align: center;

            padding: 30px;
        }

        .empty-inner {
            max-width: 300px;
        }

        .empty-icon {
            font-size: 52px;
            margin-bottom: 16px;
        }

        .empty h2 {
            margin: 0 0 8px;
            font-size: 21px;
        }

        .empty p {
            margin: 0;

            color: rgba(255,255,255,.55);
            line-height: 1.5;
        }

        /* =========================
           BOTTOM NAV
        ========================= */

        .bottom-nav {
            position: absolute;
            z-index: 50;

            left: 50%;
            bottom: 9px;

            transform: translateX(-50%);

            width: min(470px, calc(100% - 20px));

            height: 64px;

            display: grid;
            grid-template-columns: repeat(4, 1fr);

            padding: 5px;

            border-radius: 21px;

            background: rgba(22,22,29,.88);
            border: 1px solid rgba(255,255,255,.07);

            box-shadow: 0 15px 50px rgba(0,0,0,.35);

            backdrop-filter: blur(25px);
        }

        .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;

            gap: 3px;

            border-radius: 16px;

            background: transparent;

            color: rgba(255,255,255,.45);

            cursor: pointer;
        }

        .nav-item.active {
            color: white;
            background: rgba(255,255,255,.09);
        }

        .nav-icon {
            font-size: 19px;
        }

        .nav-label {
            font-size: 9px;
            font-weight: 600;
        }

        /* =========================
           SEARCH
        ========================= */

        .search-screen {
            padding: 76px 16px 88px;
            overflow-y: auto;
        }

        .page-title {
            margin: 0 0 18px;

            font-size: 30px;
            letter-spacing: -1px;
        }

        .search-box {
            position: relative;

            display: flex;
            align-items: center;

            width: 100%;
            height: 54px;

            margin-bottom: 22px;
        }

        .search-box input {
            width: 100%;
            height: 100%;

            padding: 0 48px 0 18px;

            outline: none;

            border: 1px solid rgba(255,255,255,.08);
            border-radius: 17px;

            background: rgba(255,255,255,.08);

            color: white;

            font-size: 16px;
        }

        .search-box input::placeholder {
            color: rgba(255,255,255,.4);
        }

        .search-clear {
            position: absolute;
            right: 9px;

            width: 38px;
            height: 38px;

            display: none;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background: rgba(255,255,255,.08);

            cursor: pointer;
        }

        .section-title {
            margin: 20px 0 11px;

            font-size: 14px;
            font-weight: 750;

            color: rgba(255,255,255,.72);
        }

        .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .chip {
            padding: 10px 13px;

            border-radius: 13px;

            background: rgba(255,255,255,.07);
            border: 1px solid rgba(255,255,255,.06);

            color: rgba(255,255,255,.86);

            font-size: 13px;

            cursor: pointer;
        }

        .chip:active {
            transform: scale(.96);
        }

        .categories {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .category {
            min-height: 88px;

            display: flex;
            flex-direction: column;
            justify-content: flex-end;

            padding: 14px;

            border-radius: 18px;

            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.11),
                    rgba(255,255,255,.04)
                );

            border: 1px solid rgba(255,255,255,.06);

            cursor: pointer;
        }

        .category-icon {
            font-size: 27px;
            margin-bottom: 5px;
        }

        .category-name {
            font-size: 13px;
            font-weight: 750;
        }

        .search-results {
            display: none;
        }

        .search-results.active {
            display: block;
        }

        .result-count {
            margin-bottom: 10px;

            font-size: 12px;
            color: rgba(255,255,255,.45);
        }

        .result-list {
            display: grid;
            gap: 9px;
        }

        .result-card {
            display: flex;
            align-items: center;

            gap: 12px;

            padding: 9px;

            border-radius: 17px;

            background: rgba(255,255,255,.06);

            cursor: pointer;
        }

        .result-image {
            width: 65px;
            height: 65px;

            flex: 0 0 65px;

            border-radius: 12px;

            object-fit: cover;
        }

        .result-info {
            min-width: 0;
        }

        .result-brand {
            font-size: 11px;
            color: rgba(255,255,255,.45);
        }

        .result-title {
            margin-top: 3px;

            font-size: 13px;
            font-weight: 700;

            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .result-price {
            margin-top: 5px;

            font-size: 13px;
            font-weight: 800;
        }

        /* =========================
           PROFILE
        ========================= */

        .profile-screen {
            padding: 76px 16px 90px;
            overflow-y: auto;
        }

        .profile-head {
            display: flex;
            align-items: center;

            gap: 15px;

            margin-bottom: 22px;
        }

        .profile-avatar {
            width: 67px;
            height: 67px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background:
                linear-gradient(
                    135deg,
                    #8b5cf6,
                    #ec4899
                );

            font-size: 27px;
            font-weight: 800;

            box-shadow:
                0 10px 30px rgba(139,92,246,.25);
        }

        .profile-name {
            font-size: 21px;
            font-weight: 800;
        }

        .profile-subtitle {
            margin-top: 4px;

            color: rgba(255,255,255,.45);
            font-size: 12px;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);

            gap: 8px;

            margin-bottom: 22px;
        }

        .stat {
            padding: 14px 8px;

            text-align: center;

            border-radius: 17px;

            background: rgba(255,255,255,.06);
        }

        .stat-number {
            font-size: 18px;
            font-weight: 850;
        }

        .stat-label {
            margin-top: 4px;

            font-size: 10px;
            color: rgba(255,255,255,.45);
        }

        .profile-section {
            margin-top: 20px;
        }

        .profile-section-title {
            margin-bottom: 10px;

            font-size: 14px;
            font-weight: 800;
        }

        .collection-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);

            gap: 10px;
        }

        .collection {
            position: relative;

            min-height: 115px;

            padding: 14px;

            overflow: hidden;

            border-radius: 19px;

            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.11),
                    rgba(255,255,255,.04)
                );

            border: 1px solid rgba(255,255,255,.06);

            cursor: pointer;
        }

        .collection-icon {
            font-size: 30px;
        }

        .collection-name {
            position: absolute;
            left: 14px;
            bottom: 25px;

            font-size: 13px;
            font-weight: 800;
        }

        .collection-count {
            position: absolute;
            left: 14px;
            bottom: 10px;

            font-size: 10px;
            color: rgba(255,255,255,.45);
        }

        .recent-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 9px;
        }

        .recent-card {
            position: relative;

            height: 190px;

            overflow: hidden;

            border-radius: 17px;

            background: #15151b;

            cursor: pointer;
        }

        .recent-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .recent-card::after {
            content: "";

            position: absolute;
            inset: 45% 0 0;

            background: linear-gradient(
                transparent,
                rgba(0,0,0,.8)
            );
        }

        .recent-price {
            position: absolute;
            z-index: 2;

            left: 10px;
            bottom: 9px;

            font-size: 13px;
            font-weight: 800;
        }

        /* =========================
           FAVORITES
        ========================= */

        .favorites-screen {
            padding: 76px 16px 88px;
            overflow-y: auto;
        }

        .favorites-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .favorite-card {
            position: relative;

            height: 250px;

            overflow: hidden;

            border-radius: 19px;

            background: #15151b;

            cursor: pointer;
        }

        .favorite-card img {
            width: 100%;
            height: 100%;

            object-fit: cover;
        }

        .favorite-card::after {
            content: "";

            position: absolute;
            inset: 50% 0 0;

            background: linear-gradient(
                transparent,
                rgba(0,0,0,.85)
            );
        }

        .favorite-info {
            position: absolute;
            z-index: 2;

            left: 11px;
            right: 11px;
            bottom: 10px;
        }

        .favorite-title {
            font-size: 12px;
            font-weight: 750;

            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .favorite-price {
            margin-top: 4px;

            font-size: 13px;
            font-weight: 850;
        }

        /* =========================
           COMMENTS
        ========================= */

        .comments-overlay {
            position: fixed;
            z-index: 100;

            inset: 0;

            display: none;

            background: rgba(0,0,0,.55);
            backdrop-filter: blur(5px);
        }

        .comments-overlay.show {
            display: block;
        }

        .comments {
            position: absolute;

            left: 0;
            right: 0;
            bottom: 0;

            max-height: 70vh;

            padding: 18px;

            border-radius: 26px 26px 0 0;

            background: #17171d;

            box-shadow: 0 -20px 70px rgba(0,0,0,.45);
        }

        .comments-handle {
            width: 42px;
            height: 4px;

            margin: 0 auto 17px;

            border-radius: 999px;

            background: rgba(255,255,255,.2);
        }

        .comments-title {
            font-size: 17px;
            font-weight: 800;

            margin-bottom: 15px;
        }

        .comment {
            padding: 11px 0;

            border-bottom: 1px solid rgba(255,255,255,.06);
        }

        .comment-user {
            font-size: 12px;
            font-weight: 800;
        }

        .comment-text {
            margin-top: 4px;

            font-size: 13px;
            color: rgba(255,255,255,.65);
        }

        /* =========================
           TOAST
        ========================= */

        #toast {
            position: fixed;
            z-index: 200;

            left: 50%;
            bottom: 88px;

            transform:
                translateX(-50%)
                translateY(20px);

            padding: 11px 15px;

            border-radius: 13px;

            background: rgba(20,20,26,.94);

            border: 1px solid rgba(255,255,255,.08);

            box-shadow: 0 10px 35px rgba(0,0,0,.35);

            font-size: 12px;

            opacity: 0;
            pointer-events: none;

            transition:
                opacity .2s ease,
                transform .2s ease;

            white-space: nowrap;
        }

        #toast.show {
            opacity: 1;

            transform:
                translateX(-50%)
                translateY(0);
        }

        /* =========================
           DESKTOP
        ========================= */

        @media (min-width: 700px) {
            .feed {
                padding-top: 76px;
                padding-bottom: 90px;
            }

            .card {
                height: min(760px, calc(100vh - 150px));
            }

            .search-screen,
            .profile-screen,
            .favorites-screen {
                width: 470px;
                margin: auto;
            }
        }

        /* =========================
           SMALL SCREEN
        ========================= */

        @media (max-height: 650px) {
            .card {
                min-height: 0;
                height: calc(100vh - 145px);
            }

            .product-info {
                bottom: 17px;
            }

            .actions {
                bottom: 18px;
                gap: 10px;
            }

            .action-icon {
                width: 43px;
                height: 43px;
            }
        }
    </style>
</head>

<body>

<div class="background">
    <div class="blob one"></div>
    <div class="blob two"></div>
    <div class="blob three"></div>
</div>

<div id="app">

    <!-- =========================
         FEED
    ========================= -->

    <section id="feedScreen" class="screen active feed-screen">

        <header class="topbar">
            <div class="logo">
                Style<span>Flow</span>
            </div>

            <button
                class="top-search"
                onclick="switchTab('search')"
            >
                🔎
            </button>
        </header>

        <main class="feed">

            <div id="productCard" class="card">

                <div class="product-media">
                    <img id="productImage" src="" alt="Товар">
                </div>

                <div class="product-info">

                    <div id="productSource" class="source-badge">
                        Marketplace
                    </div>

                    <div id="productBrand" class="brand">
                        Brand
                    </div>

                    <h1 id="productTitle" class="title">
                        Загрузка...
                    </h1>

                    <div class="meta">
                        <span id="productRating" class="rating">
                            ★ 4.8
                        </span>

                        <span id="productCategory">
                            Одежда
                        </span>
                    </div>

                    <div>
                        <span id="productPrice" class="price">
                            —
                        </span>

                        <span id="productOldPrice" class="old-price"></span>
                    </div>

                    <button
                        class="open-product"
                        onclick="openCurrentProduct()"
                    >
                        Открыть товар ↗
                    </button>

                </div>

                <div class="actions">

                    <button
                        id="likeButton"
                        class="action"
                        onclick="toggleLike()"
                    >
                        <span class="action-icon">♥</span>
                        <span class="action-label">Нравится</span>
                    </button>

                    <button
                        class="action"
                        onclick="openComments()"
                    >
                        <span class="action-icon">💬</span>
                        <span class="action-label">Отзывы</span>
                    </button>

                    <button
                        class="action"
                        onclick="shareCurrentProduct()"
                    >
                        <span class="action-icon">↗</span>
                        <span class="action-label">Поделиться</span>
                    </button>

                </div>

                <div id="bigHeart" class="big-heart">
                    ❤️
                </div>

            </div>

            <div id="feedEmpty" class="empty" style="display:none;">
                <div class="empty-inner">
                    <div class="empty-icon">👕</div>
                    <h2>Товаров пока нет</h2>
                    <p>
                        Когда подключим источники маркетплейсов,
                        здесь появится твоя лента.
                    </p>
                </div>
            </div>

        </main>

    </section>

    <!-- =========================
         FAVORITES
    ========================= -->

    <section id="favoritesScreen" class="screen favorites-screen">

        <h1 class="page-title">Избранное</h1>

        <div id="favoritesGrid" class="favorites-grid"></div>

        <div
            id="favoritesEmpty"
            class="empty"
            style="position:relative; min-height:420px;"
        >
            <div class="empty-inner">
                <div class="empty-icon">♡</div>

                <h2>Пока пусто</h2>

                <p>
                    Лайкай вещи в ленте —
                    они появятся здесь.
                </p>
            </div>
        </div>

    </section>

    <!-- =========================
         SEARCH
    ========================= -->

    <section id="searchScreen" class="screen search-screen">

        <h1 class="page-title">Поиск</h1>

        <div class="search-box">

            <input
                id="searchInput"
                type="text"
                autocomplete="off"
                placeholder="Что ищем? Например, чёрное худи"
            >

            <button
                id="searchClear"
                class="search-clear"
                onclick="clearSearch()"
            >
                ×
            </button>

        </div>

        <div id="searchHome">

            <div class="section-title">
                Популярное
            </div>

            <div class="chips">

                <button class="chip" onclick="quickSearch('кроссовки')">
                    👟 кроссовки
                </button>

                <button class="chip" onclick="quickSearch('худи')">
                    🧥 худи
                </button>

                <button class="chip" onclick="quickSearch('футболки')">
                    👕 футболки
                </button>

                <button class="chip" onclick="quickSearch('джинсы')">
                    👖 джинсы
                </button>

                <button class="chip" onclick="quickSearch('куртки')">
                    🧥 куртки
                </button>

                <button class="chip" onclick="quickSearch('nike')">
                    Nike
                </button>

            </div>

            <div class="section-title">
                Категории
            </div>

            <div class="categories">

                <button
                    class="category"
                    onclick="quickSearch('обувь')"
                >
                    <span class="category-icon">👟</span>
                    <span class="category-name">Обувь</span>
                </button>

                <button
                    class="category"
                    onclick="quickSearch('футболки')"
                >
                    <span class="category-icon">👕</span>
                    <span class="category-name">Футболки</span>
                </button>

                <button
                    class="category"
                    onclick="quickSearch('куртки')"
                >
                    <span class="category-icon">🧥</span>
                    <span class="category-name">Куртки</span>
                </button>

                <button
                    class="category"
                    onclick="quickSearch('брюки')"
                >
                    <span class="category-icon">👖</span>
                    <span class="category-name">Брюки</span>
                </button>

                <button
                    class="category"
                    onclick="quickSearch('аксессуары')"
                >
                    <span class="category-icon">🧢</span>
                    <span class="category-name">Аксессуары</span>
                </button>

                <button
                    class="category"
                    onclick="quickSearch('oversize')"
                >
                    <span class="category-icon">🔥</span>
                    <span class="category-name">Oversize</span>
                </button>

            </div>

            <div class="section-title">
                Источники
            </div>

            <div class="chips">

                <button class="chip" onclick="quickSearch('wildberries')">
                    🟣 Wildberries
                </button>

                <button class="chip" onclick="quickSearch('ozon')">
                    🔵 Ozon
                </button>

                <button class="chip" onclick="quickSearch('aliexpress')">
                    🟠 AliExpress
                </button>

                <button class="chip" onclick="quickSearch('kufar')">
                    🟢 Kufar
                </button>

            </div>

        </div>

        <div id="searchResults" class="search-results">

            <div id="resultCount" class="result-count"></div>

            <div id="resultList" class="result-list"></div>

        </div>

    </section>

    <!-- =========================
         PROFILE
    ========================= -->

    <section id="profileScreen" class="screen profile-screen">

        <h1 class="page-title">
            Мой Style
        </h1>

        <div class="profile-head">

            <div id="profileAvatar" class="profile-avatar">
                S
            </div>

            <div>
                <div id="profileName" class="profile-name">
                    Style Explorer
                </div>

                <div class="profile-subtitle">
                    Твой стиль. Твои находки.
                </div>
            </div>

        </div>

        <div class="stats">

            <div class="stat">
                <div id="likedCount" class="stat-number">0</div>
                <div class="stat-label">❤️ лайков</div>
            </div>

            <div class="stat">
                <div id="viewedCount" class="stat-number">0</div>
                <div class="stat-label">👁 просмотрено</div>
            </div>

            <div class="stat">
                <div id="openedCount" class="stat-number">0</div>
                <div class="stat-label">↗ переходов</div>
            </div>

        </div>

        <div class="profile-section">

            <div class="profile-section-title">
                Твои коллекции
            </div>

            <div class="collection-grid">

                <div
                    class="collection"
                    onclick="openCollection('favorites')"
                >
                    <div class="collection-icon">🔥</div>
                    <div class="collection-name">
                        Хочу купить
                    </div>
                    <div id="collectionCount" class="collection-count">
                        0 товаров
                    </div>
                </div>

                <div
                    class="collection"
                    onclick="quickSearch('обувь')"
                >
                    <div class="collection-icon">👟</div>
                    <div class="collection-name">
                        Обувь
                    </div>
                    <div class="collection-count">
                        Смотреть →
                    </div>
                </div>

                <div
                    class="collection"
                    onclick="quickSearch('осень')"
                >
                    <div class="collection-icon">🧥</div>
                    <div class="collection-name">
                        Осень
                    </div>
                    <div class="collection-count">
                        Смотреть →
                    </div>
                </div>

                <div
                    class="collection"
                    onclick="quickSearch('до 100')"
                >
                    <div class="collection-icon">💸</div>
                    <div class="collection-name">
                        До 100
                    </div>
                    <div class="collection-count">
                        Смотреть →
                    </div>
                </div>

            </div>

        </div>

        <div class="profile-section">

            <div class="profile-section-title">
                Недавно смотрел
            </div>

            <div id="recentGrid" class="recent-grid"></div>

        </div>

    </section>

    <!-- =========================
         BOTTOM NAV
    ========================= -->

    <nav class="bottom-nav">

        <button
            id="navFeed"
            class="nav-item active"
            onclick="switchTab('feed')"
        >
            <span class="nav-icon">⌂</span>
            <span class="nav-label">Лента</span>
        </button>

        <button
            id="navFavorites"
            class="nav-item"
            onclick="switchTab('favorites')"
        >
            <span class="nav-icon">♡</span>
            <span class="nav-label">Избранное</span>
        </button>

        <button
            id="navSearch"
            class="nav-item"
            onclick="switchTab('search')"
        >
            <span class="nav-icon">⌕</span>
            <span class="nav-label">Поиск</span>
        </button>

        <button
            id="navProfile"
            class="nav-item"
            onclick="switchTab('profile')"
        >
            <span class="nav-icon">○</span>
            <span class="nav-label">Мой Style</span>
        </button>

    </nav>

</div>

<!-- COMMENTS -->

<div
    id="commentsOverlay"
    class="comments-overlay"
    onclick="closeComments(event)"
>

    <div
        class="comments"
        onclick="event.stopPropagation()"
    >

        <div class="comments-handle"></div>

        <div class="comments-title">
            Отзывы
        </div>

        <div id="commentsList"></div>

    </div>

</div>

<div id="toast"></div>

<script>
/* =========================================================
STYLEFLOW
Personalized marketplace feed

ЭТАП 5:

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

10. Фильтры:
    * свободный текстовый запрос
    * минимальная цена
    * максимальная цена
    * маркетплейс
    * сортировка

ВАЖНО:

Фильтр НЕ содержит фиксированных категорий.

Пользователь сам пишет, что ищет:

    машина
    BMW
    ноутбук
    iPhone
    ремонт телефона
    квартира
    кроссовки
    и т.д.

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

// История навигации внутри текущей сессии.
// Нужна, чтобы случайно пропущенную карточку можно было вернуть назад.
let navigationHistory = [];
let navigationPosition = -1;
let infoPanelCollapsed = false;


/* =========================================================
SERVER USER HISTORY
========================================================= */

let telegramUserId = null;

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
        sources: [],
        sort: "relevance"
    }
);


/*
Защита от старого/битого localStorage.

Если раньше здесь хранилась старая версия
фильтров с categories — полностью переходим
на новую структуру.
*/

if (
    !activeFilters ||
    typeof activeFilters !== "object"
) {

    activeFilters = {
        query: "",
        minPrice: null,
        maxPrice: null,
        sources: [],
        sort: "relevance"
    };
}


if (
    typeof activeFilters.query !== "string"
) {

    activeFilters.query = "";
}


if (
    !Array.isArray(
        activeFilters.sources
    )
) {

    activeFilters.sources = [];
}


if (
    activeFilters.sort !== "relevance" &&
    activeFilters.sort !== "newest" &&
    activeFilters.sort !== "price_asc" &&
    activeFilters.sort !== "price_desc"
) {

    activeFilters.sort = "relevance";
}


/*
Старые категории больше не используются.

Удаляем их из состояния фильтров,
чтобы старые данные localStorage
не влияли на новую систему.
*/

delete activeFilters.categories;


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
        setupSearchSuggestions();

        setupSwipe();


        telegramUserId =
            getTelegramUserId();


        console.log(
            "[StyleFlow] Telegram user ID:",
            telegramUserId || "не найден"
        );


        /*
        Сначала история.
        */

        await loadUserHistory();


        /*
        Потом каталог.
        */

        await loadFeed();


        /*
        Обновляем профиль.
        */

        updateProfile();
    }
);


/* =========================================================
LOAD USER HISTORY
========================================================= */

async function loadUserHistory() {

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


        /*
        Обновляем только источники.

        Категорий в фильтре больше нет.
        */

        renderFilterSources();

        syncFilterUI();


        /*
        Строим ленту.

        Фильтры применятся внутри
        buildPersonalizedFeed().
        */

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


            renderFilterSources();

            syncFilterUI();


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


    /*
    Категория больше не подставляется.

    Если источник передал категорию —
    сохраняем её для алгоритма рекомендаций
    и свободного поиска.

    Если категории нет —
    оставляем пустую строку.
    */

    const category =
        String(
            item.category ||
            item.type ||
            ""
        ).trim();


    const description =
        String(
            item.description ||
            item.short_description ||
            item.desc ||
            ""
        ).trim();


    const id =
        String(
            item.id ??
            item.product_id ??
            item.external_id ??
            `${source}_${index}_${title}`
        );


    /*
    Сохраняем дату создания/обновления,
    если источник её передал.

    Это позволит сортировке "Сначала новые"
    работать уже сейчас для тех товаров,
    где дата присутствует.

    Если даты нет — используется
    исходный порядок каталога.
    */

    const createdAt =
        item.created_at ||
        item.createdAt ||
        item.created ||
        item.date ||
        "";


    const updatedAt =
        item.updated_at ||
        item.updatedAt ||
        item.updated ||
        "";


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

        description,

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

        createdAt,

        updatedAt,

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
FILTERS
========================================================= */


/*
Возвращает количество активных фильтров.
*/

function getActiveFilterCount() {

    let count = 0;


    if (
        activeFilters.query &&
        activeFilters.query.trim()
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
            activeFilters.sources
        ) &&
        activeFilters.sources.length
    ) {

        count +=
            activeFilters.sources.length;
    }


    /*
    Сортировка "релевантность" —
    состояние по умолчанию.

    Другие варианты считаем
    дополнительным активным параметром.
    */

    if (
        activeFilters.sort &&
        activeFilters.sort !== "relevance"
    ) {

        count++;
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


    const minInput =
        document.getElementById(
            "filterMinPrice"
        );


    const maxInput =
        document.getElementById(
            "filterMaxPrice"
        );


    const sortInput =
        document.getElementById(
            "filterSort"
        );


    const query =
        queryInput
            ? queryInput.value.trim()
            : "";


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


    const sourceButtons =
        document.querySelectorAll(
            "#filterSources .filter-chip.active"
        );


    const sources = [];


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


    let sort =
        sortInput
            ? sortInput.value
            : "relevance";


    if (
        sort !== "relevance" &&
        sort !== "newest" &&
        sort !== "price_asc" &&
        sort !== "price_desc"
    ) {

        sort = "relevance";
    }


    activeFilters = {

        query,

        minPrice,

        maxPrice,

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
    После изменения фильтров
    строим ленту заново.

    Важно:

    фильтр
        ↓
    кандидаты
        ↓
    просмотренные
        ↓
    сортировка
        ↓
    персонализация
        ↓
    лента
    */

    currentIndex = 0;


    buildPersonalizedFeed();


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


    const minInput =
        document.getElementById(
            "filterMinPrice"
        );


    const maxInput =
        document.getElementById(
            "filterMaxPrice"
        );


    const sortInput =
        document.getElementById(
            "filterSort"
        );


    if (queryInput) {

        queryInput.value =
            "";
    }


    if (minInput) {

        minInput.value =
            "";
    }


    if (maxInput) {

        maxInput.value =
            "";
    }


    if (sortInput) {

        sortInput.value =
            "relevance";
    }


    renderFilterSources();

    syncFilterUI();


    currentIndex = 0;


    buildPersonalizedFeed();


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
Выбор источника.

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
                '[data-source="__all__"]'
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
                    '[data-source="__all__"]'
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
Источники фильтра.

Создаём кнопки программно.
*/

function renderFilterSources() {

    const container =
        document.getElementById(
            "filterSources"
        );


    if (!container) {
        return;
    }


    const sources = [
        {
            value: "__all__",
            label: "Все"
        },
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


    container.innerHTML = "";


    sources.forEach(
        source => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "filter-chip";


            button.dataset.source =
                source.value;


            button.textContent =
                source.label;


            button.addEventListener(
                "click",
                () => {

                    toggleFilterChip(
                        button
                    );
                }
            );


            container.appendChild(
                button
            );
        }
    );


    syncSourceFilterUI();
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


    const minInput =
        document.getElementById(
            "filterMinPrice"
        );


    const maxInput =
        document.getElementById(
            "filterMaxPrice"
        );


    const sortInput =
        document.getElementById(
            "filterSort"
        );


    if (queryInput) {

        queryInput.value =
            activeFilters.query || "";
    }


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


    if (sortInput) {

        sortInput.value =
            activeFilters.sort ||
            "relevance";
    }


    syncSourceFilterUI();


    updateFilterButton();
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


/* =========================================================
FILTER SEARCH HELPERS
========================================================= */


/*
Нормализуем текст для поиска.

Например:

"  BMW X5  "
→
"bmw x5"
*/

function normalizeSearchText(value) {

    return String(value || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[–—−]/g, "-")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/*
Приводим слова к более устойчивой форме.
Это не полноценный морфологический словарь, но он
закрывает самые частые русские окончания и множественное
число, поэтому "ноутбук", "ноутбуки", "ноутбука" и
"ноутбуком" считаются одним поисковым намерением.
*/
function normalizeSearchToken(token) {

    let word = normalizeSearchText(token)
        .split(" ")
        .filter(Boolean)[0] || "";

    if (!word) {
        return "";
    }

    const aliases = {
        "ноут": "ноутбук",
        "ноутбуки": "ноутбук",
        "ноутбука": "ноутбук",
        "ноутбуком": "ноутбук",
        "ноутбуке": "ноутбук",
        "laptop": "ноутбук",
        "laptops": "ноутбук",
        "айфон": "iphone",
        "айфона": "iphone",
        "айфоны": "iphone",
        "айфоном": "iphone",
        "iphones": "iphone",
        "смартфон": "телефон",
        "смартфоны": "телефон",
        "смартфона": "телефон",
        "авто": "машина",
        "автомобиль": "машина",
        "автомобили": "машина",
        "машины": "машина"
    };

    if (aliases[word]) {
        return aliases[word];
    }

    // Английское множественное число.
    if (/^[a-z0-9]+$/i.test(word) && word.length > 4) {
        if (word.endsWith("ies")) {
            word = word.slice(0, -3) + "y";
        } else if (word.endsWith("es")) {
            word = word.slice(0, -2);
        } else if (word.endsWith("s")) {
            word = word.slice(0, -1);
        }
    }

    // Частые русские окончания. Не режем короткие слова.
    if (word.length >= 5) {
        const endings = [
            "ами", "ями", "ого", "ему", "ому", "ыми", "ими",
            "ее", "ие", "ые", "ое", "ей", "ов", "ев", "ам",
            "ям", "ах", "ях", "ом", "ем", "ым", "им", "ой",
            "ый", "ий", "ая", "яя", "ое", "ее", "ую", "юю",
            "ою", "ею", "ию", "ью", "ы", "и", "а", "я", "у", "ю", "е", "о"
        ];

        for (const ending of endings) {
            if (word.endsWith(ending) && word.length - ending.length >= 4) {
                word = word.slice(0, -ending.length);
                break;
            }
        }
    }

    return word;
}


function levenshteinDistance(a, b) {

    a = String(a || "");
    b = String(b || "");

    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    if (Math.abs(a.length - b.length) > 2) {
        return 3;
    }

    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;

        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,
                prev[j] + 1,
                prev[j - 1] + cost
            );
        }

        [prev, curr] = [curr, prev];
    }

    return prev[b.length];
}


function getProductSearchText(product) {

    if (!product) {
        return "";
    }

    return normalizeSearchText([
        product.title,
        product.brand,
        product.category,
        product.description,
        product.source,
        sourceLabel(product.source)
    ].filter(Boolean).join(" "));
}


function getSearchWords(product) {

    return getProductSearchText(product)
        .split(" ")
        .filter(Boolean);
}


function tokenMatchesSearch(token, words) {

    const normalizedToken = normalizeSearchToken(token);

    if (!normalizedToken) {
        return true;
    }

    // Синонимы/разговорные формы.
    const candidates = [normalizedToken];

    if (normalizedToken === "ноутбук") {
        candidates.push("ноут", "laptop");
    }

    if (normalizedToken === "телефон") {
        candidates.push("смартфон", "iphone");
    }

    for (const candidate of candidates) {
        const candidateStem = normalizeSearchToken(candidate);

        for (const rawWord of words) {
            const word = normalizeSearchToken(rawWord);

            if (!word) continue;

            if (word === candidateStem) return true;

            // Разрешаем естественные формы/дополнительные символы.
            if (word.startsWith(candidateStem) || candidateStem.startsWith(word)) {
                if (Math.min(word.length, candidateStem.length) >= 4) {
                    return true;
                }
            }

            // Одна опечатка для длинных слов.
            if (candidateStem.length >= 5 && word.length >= 5) {
                if (levenshteinDistance(candidateStem, word) <= 1) {
                    return true;
                }
            }
        }
    }

    return false;
}


function getProductSearchScore(product, query) {

    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return 0;

    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    const words = getSearchWords(product);
    const searchable = getProductSearchText(product);

    let score = 0;

    if (searchable === normalizedQuery) score += 100;
    if (searchable.includes(normalizedQuery)) score += 35;

    for (const token of queryTokens) {
        const normalizedToken = normalizeSearchToken(token);
        if (!normalizedToken) continue;

        if (normalizeSearchToken(product.title).includes(normalizedToken)) {
            score += 20;
        } else if (normalizeSearchToken(product.brand).includes(normalizedToken)) {
            score += 16;
        } else if (tokenMatchesSearch(normalizedToken, words)) {
            score += 10;
        }
    }

    return score;
}


function productMatchesQuery(product, query) {

    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
        return true;
    }

    const tokens = normalizedQuery.split(" ").filter(Boolean);
    const words = getSearchWords(product);

    return tokens.every(token => tokenMatchesSearch(token, words));
}


/* =========================================================
NEWEST SORT
========================================================= */


/*
Пытаемся получить timestamp товара.

Если timestamp отсутствует,
возвращаем 0.

Позже backend можно будет расширить
created_at — тогда сортировка "Сначала новые"
станет полноценной.
*/

function getProductTimestamp(
    product
) {

    if (!product) {
        return 0;
    }


    const value =
        product.createdAt ||
        product.updatedAt ||
        product.raw?.created_at ||
        product.raw?.createdAt ||
        product.raw?.updated_at ||
        product.raw?.updatedAt ||
        product.raw?.date ||
        "";


    if (!value) {
        return 0;
    }


    if (
        typeof value === "number"
    ) {

        return value;
    }


    const timestamp =
        Date.parse(
            String(value)
        );


    return Number.isFinite(
        timestamp
    )
        ? timestamp
        : 0;
}


/*
Сортировка "Сначала новые".

Если даты есть —
используем их.

Если дат нет —
сохраняем исходный порядок,
который пришёл с сервера.
*/

function sortNewest(
    items
) {

    return items
        .map(
            (
                product,
                index
            ) => ({

                product,

                index,

                timestamp:
                    getProductTimestamp(
                        product
                    )
            })
        )
        .sort(
            (a, b) => {

                if (
                    a.timestamp !==
                    b.timestamp
                ) {

                    return (
                        b.timestamp -
                        a.timestamp
                    );
                }


                return (
                    a.index -
                    b.index
                );
            }
        )
        .map(
            item =>
                item.product
        );
}


/*
Сортировка по цене.

Товары без цены отправляем в конец.
*/

function sortByPrice(
    items,
    direction
) {

    return items
        .map(
            (
                product,
                index
            ) => ({

                product,

                index,

                price:
                    product.price !== null &&
                    Number.isFinite(
                        Number(
                            product.price
                        )
                    )
                        ? Number(
                            product.price
                        )
                        : null
            })
        )
        .sort(
            (a, b) => {

                if (
                    a.price === null &&
                    b.price === null
                ) {

                    return (
                        a.index -
                        b.index
                    );
                }


                if (
                    a.price === null
                ) {

                    return 1;
                }


                if (
                    b.price === null
                ) {

                    return -1;
                }


                if (
                    direction ===
                    "asc"
                ) {

                    return (
                        a.price -
                        b.price
                    );
                }


                return (
                    b.price -
                    a.price
                );
            }
        )
        .map(
            item =>
                item.product
        );
}


/* =========================================================
SORT FILTERED PRODUCTS
========================================================= */

function sortFilteredProducts(
    items
) {

    const source =
        Array.isArray(items)
            ? [...items]
            : [];


    switch (
        activeFilters.sort
    ) {

        case "newest":

            return sortNewest(
                source
            );


        case "price_asc":

            return sortByPrice(
                source,
                "asc"
            );


        case "price_desc":

            return sortByPrice(
                source,
                "desc"
            );


        case "relevance":

        default:

            /*
            Для "релевантности"
            здесь ничего не сортируем.

            Если пользователь написал запрос,
            персонализация позже будет
            учитывать этот контекст.

            Сохраняем исходный порядок.
            */

            return source;
    }
}


/* =========================================================
MAIN PRODUCT FILTER
========================================================= */


/*
Главная функция фильтрации.

Порядок:

1. Свободный текст
2. Цена
3. Площадка
4. Сортировка

После этого результат передаётся
в персонализацию.

Категорий как отдельного фильтра больше нет.
*/

function applyProductFilters(
    source
) {

    const input =
        Array.isArray(source)
            ? source
            : [];


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


    const query =
        String(
            activeFilters.query ||
            ""
        ).trim();


    const sources =
        new Set(
            activeFilters.sources.map(
                source =>
                    normalizeSource(
                        source
                    )
            )
        );


    const hasSourceFilter =
        sources.size > 0;


    const filtered =
        input.filter(
            product => {

                if (!product) {
                    return false;
                }


                /*
                ================================================
                СВОБОДНЫЙ ПОИСК
                ================================================
                */

                if (
                    query &&
                    !productMatchesQuery(
                        product,
                        query
                    )
                ) {

                    return false;
                }


                /*
                ================================================
                ЦЕНА
                ================================================
                */

                if (
                    minPrice !== null ||
                    maxPrice !== null
                ) {

                    /*
                    Товары без цены при активном
                    ценовом фильтре не показываем.
                    */

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
                ================================================
                ПЛОЩАДКА
                ================================================
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


    /*
    Сортировка выполняется после фильтрации.
    */

    return sortFilteredProducts(
        filtered
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


    /*
    ========================================================
    ЭТАП 1

    Сначала применяем пользовательские фильтры.

    Только после этого запускаем
    персонализацию.
    ========================================================
    */

    const filteredProducts =
        applyProductFilters(
            allProducts
        );


    console.log(
        "[StyleFlow] После фильтров:",
        filteredProducts.length
    );


    if (
        !filteredProducts.length
    ) {

        products = [];


        console.log(
            "[StyleFlow] Фильтры не дали результатов."
        );


        return;
    }


    /*
    ========================================================
    ЭТАП 2

    Убираем просмотренные товары.
    ========================================================
    */

    const viewedSet =
        new Set(
            viewedProducts.map(
                String
            )
        );


    const unviewed =
        filteredProducts.filter(
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
        "[StyleFlow] После фильтров:",
        filteredProducts.length
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
    Уже просмотренные товары
    никогда не возвращаем автоматически.
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


    /*
    ========================================================
    ЭТАП 3

    Существующий алгоритм
    персонализации.
    ========================================================
    */

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


        /*
        Если выбрана сортировка по цене
        или по новизне, она должна иметь
        приоритет над случайной лентой.

        Поэтому специальные сортировки
        применяем после исключения просмотренных,
        но до персонализации.
        */

        if (
            activeFilters.sort ===
            "price_asc"
        ) {

            products =
                sortByPrice(
                    candidates,
                    "asc"
                );

        } else if (
            activeFilters.sort ===
            "price_desc"
        ) {

            products =
                sortByPrice(
                    candidates,
                    "desc"
                );

        } else if (
            activeFilters.sort ===
            "newest"
        ) {

            products =
                sortNewest(
                    candidates
                );
        }


        console.log(
            "[StyleFlow] Новая лента — случайная"
        );


        return;
    }


    /*
    При активной персонализации
    сначала строим оценки.
    */

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


    /*
    Явная сортировка пользователя
    имеет приоритет над алгоритмом
    персонализации.

    "Дешевле" и "Дороже" должны
    действительно показывать товары
    в выбранном порядке.

    "Новое" тоже должно быть
    предсказуемым.

    "Релевантность" использует
    персонализацию.
    */

    if (
        activeFilters.sort ===
        "price_asc"
    ) {

        products =
            sortByPrice(
                candidates,
                "asc"
            );

    } else if (
        activeFilters.sort ===
        "price_desc"
    ) {

        products =
            sortByPrice(
                candidates,
                "desc"
            );

    } else if (
        activeFilters.sort ===
        "newest"
    ) {

        products =
            sortNewest(
                candidates
            );

    } else {

        products =
            buildWeightedDiverseFeed(
                scored,
                personalization
            );
    }


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


    /*
    ================================================
    КАТЕГОРИЯ
    ================================================
    */

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


    /*
    ================================================
    БРЕНД
    ================================================
    */

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


    /*
    ================================================
    ПЛОЩАДКА
    ================================================
    */

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


    /*
    ================================================
    ЦЕНА
    ================================================
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


    /*
    ================================================
    СЛУЧАЙНОСТЬ
    ================================================

    Сохраняем немного случайности,
    чтобы лента не превращалась
    в полностью предсказуемый список.
    */

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


function uniqueStrings(
    values
) {

    const result = [];

    const seen =
        new Set();


    (
        Array.isArray(values)
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


    ensureNavigationHistory();


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


    if (image) {

        image.src =
            currentProduct.image;


        image.alt =
            currentProduct.title;
    }


    if (title) {

        title.textContent =
            currentProduct.title;
    }


    if (brand) {

        brand.textContent =
            currentProduct.brand ||
            "StyleFlow";
    }


    if (source) {

        source.textContent =
            sourceLabel(
                currentProduct.source
            );
    }


    if (price) {

        price.textContent =
            formatPrice(
                currentProduct
            );
    }


    if (oldPrice) {

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
    }


    if (rating) {

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
    }


    /*
    Если категория отсутствует,
    показываем нейтральный символ,
    а не "Одежда".
    */

    if (category) {

        category.textContent =
            currentProduct.category ||
            "—";
    }


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


    if (!screens[tab]) {
        return;
    }


    currentTab =
        tab;


    Object.values(
        screens
    ).forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.classList.toggle(
                    "active",
                    id === screens[tab]
                );
            }
        }
    );


    Object.values(
        navs
    ).forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.classList.toggle(
                    "active",
                    id === navs[tab]
                );
            }
        }
    );


    if (
        tab ===
        "favorites"
    ) {

        renderFavorites();
    }


    if (
        tab ===
        "profile"
    ) {

        updateProfile();
    }


    if (
        tab ===
        "search"
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
            180
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


    if (
        !grid ||
        !empty
    ) {

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

    const url = String(
        currentProduct.url ||
        currentProduct.link ||
        ""
    ).trim();

    if (!url || url === "#") {
        showToast("Ссылка на товар пока не подключена");
        return;
    }

    registerOpen(currentProduct);

    /*
    На ПК Telegram Desktop/обычный браузер может не отработать
    через WebApp.openLink так, как на телефоне. Поэтому сначала
    пробуем обычное окно, а если браузер его заблокировал —
    переходим по ссылке в текущем окне.
    */
    try {
        const telegram = window.Telegram && window.Telegram.WebApp;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

        if (telegram && typeof telegram.openLink === "function" && isMobile) {
            telegram.openLink(url);
            return;
        }

        const opened = window.open(url, "_blank", "noopener,noreferrer");

        if (!opened) {
            window.location.href = url;
        }

    } catch (error) {
        console.warn("[StyleFlow] Не удалось открыть товар через новое окно:", error);

        try {
            if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openLink) {
                Telegram.WebApp.openLink(url);
            } else {
                window.location.href = url;
            }
        } catch (fallbackError) {
            window.location.href = url;
        }
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
            "—";
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

        /*
        Пользователь мог просто закрыть
        системное окно Share.
        */
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


    if (
        !overlay ||
        !list
    ) {

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


function setupSearchSuggestions() {

    const inputs = [
        document.getElementById("searchInput"),
        document.getElementById("filterQuery")
    ].filter(Boolean);

    inputs.forEach(input => {

        let box = input.parentElement
            ? input.parentElement.querySelector(".styleflow-suggestions")
            : null;

        if (!box) {
            box = document.createElement("div");
            box.className = "styleflow-suggestions";

            Object.assign(box.style, {
                position: "absolute",
                left: "0",
                right: "0",
                top: "calc(100% + 6px)",
                zIndex: "1000",
                display: "none",
                padding: "6px",
                borderRadius: "14px",
                background: "rgba(18,18,24,.96)",
                border: "1px solid rgba(255,255,255,.08)",
                boxShadow: "0 14px 40px rgba(0,0,0,.35)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)"
            });

            const parent = input.parentElement;
            if (parent) {
                if (getComputedStyle(parent).position === "static") {
                    parent.style.position = "relative";
                }
                parent.appendChild(box);
            }
        }

        const render = () => {
            const value = input.value.trim();

            if (!value || !allProducts.length) {
                box.style.display = "none";
                box.innerHTML = "";
                return;
            }

            const normalized = normalizeSearchText(value);
            const candidates = allProducts
                .map(product => ({
                    product,
                    score: getProductSearchScore(product, value)
                }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 6);

            const seen = new Set();
            const suggestions = [];

            // Сначала показываем сам пользовательский запрос,
            // затем названия/бренды реальных найденных товаров.
            if (normalized) {
                seen.add(normalized);
                suggestions.push(value);
            }

            candidates.forEach(({product}) => {
                const text = String(product.title || product.brand || "").trim();
                if (!text) return;

                const key = normalizeSearchText(text);
                if (seen.has(key)) return;

                seen.add(key);
                suggestions.push(text);
            });

            box.innerHTML = "";

            suggestions.slice(0, 6).forEach(text => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = text;

                Object.assign(button.style, {
                    display: "block",
                    width: "100%",
                    padding: "10px 12px",
                    border: "0",
                    borderRadius: "10px",
                    background: "transparent",
                    color: "#fff",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "14px"
                });

                button.addEventListener("mouseenter", () => {
                    button.style.background = "rgba(255,255,255,.08)";
                });

                button.addEventListener("mouseleave", () => {
                    button.style.background = "transparent";
                });

                button.addEventListener("click", () => {
                    input.value = text;
                    box.style.display = "none";
                    input.dispatchEvent(new Event("input", {bubbles: true}));

                    if (input.id === "searchInput") {
                        performSearch(text);
                    }
                });

                box.appendChild(button);
            });

            box.style.display = suggestions.length ? "block" : "none";
        };

        input.addEventListener("input", render);
        input.addEventListener("focus", render);
        input.addEventListener("blur", () => {
            setTimeout(() => {
                box.style.display = "none";
            }, 180);
        });
    });
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


    if (
        !home ||
        !results ||
        !resultList ||
        !resultCount
    ) {

        return;
    }


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


    const filtered =
        allProducts
            .filter(
                product =>
                    productMatchesQuery(
                        product,
                        query
                    )
            )
            .sort(
                (a, b) =>
                    getProductSearchScore(b, query) -
                    getProductSearchScore(a, query)
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
                        бренд или описание.
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

function setupSwipe() {

    const card = document.getElementById("productCard");

    if (!card) {
        return;
    }

    // Вертикальный жест оставляем браузеру/Telegram,
    // горизонтальный жест используется только для карточек.
    card.style.touchAction = "pan-y";

    let pointerStartY = 0;
    let pointerStartX = 0;
    let pointerActive = false;
    let pointerMoved = false;
    let pointerHorizontal = false;
    let pointerId = null;

    card.addEventListener("pointerdown", event => {

        if (!currentProduct) return;

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        // Кнопки, ссылки и элементы управления не должны превращаться в свайп.
        if (event.target.closest("button, a, input, textarea, select")) {
            return;
        }

        pointerStartY = event.clientY;
        pointerStartX = event.clientX;
        pointerActive = true;
        pointerMoved = false;
        pointerHorizontal = false;
        pointerId = event.pointerId;
        isDragging = true;

        card.classList.add("dragging");

        try {
            card.setPointerCapture(pointerId);
        } catch (e) {}
    });

    card.addEventListener("pointermove", event => {

        if (!pointerActive || event.pointerId !== pointerId) {
            return;
        }

        const deltaY = event.clientY - pointerStartY;
        const deltaX = event.clientX - pointerStartX;

        if (Math.abs(deltaY) < 4 && Math.abs(deltaX) < 4) {
            return;
        }

        pointerMoved = true;

        // Вертикальное движение НИКОГДА не переключает товар.
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
            pointerHorizontal = false;
            card.style.transform = "";
            return;
        }

        pointerHorizontal = true;
        event.preventDefault();

        card.style.transform =
            `translateX(${deltaX}px) rotate(${deltaX * 0.035}deg)`;
    });

    function finishPointer(event) {

        if (!pointerActive) return;

        if (pointerId !== null && event.pointerId !== pointerId) {
            return;
        }

        const deltaY = event.clientY - pointerStartY;
        const deltaX = event.clientX - pointerStartX;

        const wasHorizontalSwipe =
            pointerHorizontal &&
            Math.abs(deltaX) > 80 &&
            Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

        pointerActive = false;
        pointerId = null;
        isDragging = false;

        card.classList.remove("dragging");

        try {
            card.releasePointerCapture(event.pointerId);
        } catch (e) {}

        card.style.transform = "";

        if (wasHorizontalSwipe) {
            if (deltaX < 0) {
                nextProduct();
            } else {
                previousProduct();
            }

            lastTapTime = 0;
            return;
        }

        // Вертикальный жест полностью игнорируется.
        // Это позволяет Telegram/браузеру нормально закрываться/сворачиваться.
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            lastTapTime = 0;
            return;
        }

        if (!pointerMoved) {
            const now = Date.now();

            if (now - lastTapTime < 350) {
                toggleLike();
                lastTapTime = 0;
                return;
            }

            lastTapTime = now;
        }
    }

    card.addEventListener("pointerup", finishPointer);

    card.addEventListener("pointercancel", () => {
        pointerActive = false;
        pointerId = null;
        isDragging = false;
        card.classList.remove("dragging");
        card.style.transform = "";
    });

    card.addEventListener("pointerleave", event => {
        if (event.pointerType === "mouse" && pointerActive) {
            finishPointer(event);
        }
    });

    /*
    Колесо мыши больше НЕ переключает карточки.
    Иначе обычная прокрутка страницы/Telegram Desktop
    случайно скипает товар.

    Горизонтальная прокрутка тачпада всё ещё может переключать,
    если deltaX явно сильнее deltaY.
    */
    let wheelLocked = false;

    card.addEventListener("wheel", event => {

        if (wheelLocked) return;

        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
            return;
        }

        if (Math.abs(event.deltaX) < 45) {
            return;
        }

        wheelLocked = true;

        if (event.deltaX > 0) {
            nextProduct();
        } else {
            previousProduct();
        }

        setTimeout(() => {
            wheelLocked = false;
        }, 300);
    }, { passive: true });

    document.addEventListener("keydown", event => {

        if (currentTab !== "feed") return;

        if (event.key === "ArrowRight") {
            event.preventDefault();
            nextProduct();
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            previousProduct();
        }

        // Стрелки вверх/вниз больше не переключают карточку:
        // пользователь может использовать их для обычной прокрутки.
    });

    setupInfoCollapse(card);
}


function setupInfoCollapse(card) {

    if (!card || card.querySelector(".styleflow-info-toggle")) {
        return;
    }

    const info = card.querySelector(".product-info");

    if (!info) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "styleflow-info-toggle";
    toggle.textContent = "⌄";
    toggle.setAttribute("aria-label", "Свернуть информацию о товаре");

    Object.assign(toggle.style, {
        position: "absolute",
        right: "14px",
        bottom: "14px",
        width: "38px",
        height: "38px",
        border: "0",
        borderRadius: "50%",
        background: "rgba(0,0,0,.48)",
        color: "#fff",
        fontSize: "20px",
        lineHeight: "38px",
        padding: "0",
        zIndex: "20",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)"
    });

    toggle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        infoPanelCollapsed = !infoPanelCollapsed;
        info.classList.toggle("collapsed", infoPanelCollapsed);
        card.classList.toggle("info-collapsed", infoPanelCollapsed);

        if (infoPanelCollapsed) {
            info.style.maxHeight = "78px";
            info.style.overflow = "hidden";
            toggle.textContent = "⌃";
            toggle.setAttribute("aria-label", "Развернуть информацию о товаре");
        } else {
            info.style.maxHeight = "";
            info.style.overflow = "";
            toggle.textContent = "⌄";
            toggle.setAttribute("aria-label", "Свернуть информацию о товаре");
        }
    });

    card.appendChild(toggle);
}


/* =========================================================
NAVIGATION HISTORY
========================================================= */

function resetNavigationHistory() {
    navigationHistory = [];
    navigationPosition = -1;
}


function ensureNavigationHistory() {
    if (!currentProduct) return;

    const id = String(currentProduct.id);

    if (!navigationHistory.length) {
        navigationHistory = [id];
        navigationPosition = 0;
        return;
    }

    if (navigationPosition < 0) {
        navigationPosition = navigationHistory.length - 1;
    }
}


function rememberNextNavigation(product) {
    if (!product) return;

    ensureNavigationHistory();

    // Если пользователь вернулся назад, новая ветка начинается здесь.
    if (navigationPosition < navigationHistory.length - 1) {
        navigationHistory = navigationHistory.slice(0, navigationPosition + 1);
    }

    const id = String(product.id);

    if (navigationHistory[navigationHistory.length - 1] !== id) {
        navigationHistory.push(id);
    }

    navigationPosition = navigationHistory.length - 1;

    if (navigationHistory.length > 100) {
        navigationHistory.shift();
        navigationPosition--;
    }
}


function findProductById(id) {
    const target = String(id);

    return allProducts.find(product => String(product.id) === target) ||
        products.find(product => String(product.id) === target) ||
        null;
}


function nextProduct() {

    if (!products.length) {
        buildPersonalizedFeed();
        currentIndex = 0;

        if (!products.length) {
            showEmptyFeed();
            return;
        }

        resetNavigationHistory();
        showProduct();
        return;
    }

    const nextIndex = findNextUnviewedIndex(currentIndex, 1);

    if (nextIndex >= 0) {
        if (currentProduct) {
            rememberNextNavigation(currentProduct);
        }

        currentIndex = nextIndex;
        animateCardChange("next");
        return;
    }

    const filteredProducts = applyProductFilters(allProducts);
    const unviewed = filteredProducts.filter(product => !isProductViewed(product));

    if (unviewed.length > 0) {
        if (currentProduct) {
            rememberNextNavigation(currentProduct);
        }

        buildPersonalizedFeed();
        currentIndex = 0;

        if (products.length > 0) {
            animateCardChange("next");
        } else {
            showEmptyFeed();
        }

        return;
    }

    showEmptyFeed();
    showToast("Ты просмотрел все доступные товары");
}


function previousProduct() {

    ensureNavigationHistory();

    if (navigationPosition <= 0) {
        showToast("Это первая карточка в этой сессии");
        return;
    }

    const previousId = navigationHistory[navigationPosition - 1];
    const previous = findProductById(previousId);

    if (!previous) {
        navigationPosition--;
        previousProduct();
        return;
    }

    navigationPosition--;

    const index = products.findIndex(
        product => String(product.id) === String(previous.id)
    );

    if (index >= 0) {
        currentIndex = index;
        animateCardChange("previous");
        return;
    }

    // Если текущая персонализация уже перестроила массив,
    // возвращаем конкретный товар в начало текущей ленты.
    products.unshift(previous);
    currentIndex = 0;
    animateCardChange("previous");
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
            ? "translateX(-28px)"
            : "translateX(28px)";


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
</script>

</body>
</html>
