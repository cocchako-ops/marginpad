/* MarginPad shared desktop nav - injects a top-left hamburger that opens a searchable left drawer.
   Self-contained (own CSS), desktop-only (≥721px). Loaded on standalone pages; the homepage has its own Browse panel. */
(function () {
  if (window.__mpNavLoaded) return; window.__mpNavLoaded = 1;
  var MPI = {"en":{"brBrowse":"Browse","brSearch":"Search pages, guides, coins…","brNoRes":"No matches for","secNew":"New here?","secTrade":"Trade","secEarn":"Earn","secMore":"More","brWtsT":"Where to start","brWtsS":"Crypto from zero - a free beginner path","prodPaper":"Paper Trade","brPaperS":"Practice at the live price · zero risk","brToolsT":"Trading Tools","brToolsS":"Backtester · journal · pivots · risk","prodScreener":"Screener","brScrS":"Live markets · movers, funding, OI","brMktsT":"Markets","brMktsS":"Top 100 coins · prices & market cap","brDefiT":"DeFi","brDefiS":"TVL, chains, protocols & stablecoins","brNewsT":"Crypto News","brNewsS":"Latest headlines · live","brFngT":"Fear & Greed","brFngS":"Live market sentiment","prodCharts":"Charts","prodChartsS":"Your windowed workspace","navRekt":"Rekt","prodRektS":"Live liquidations feed","brAlertsT":"Price Alerts","brAlertsS":"Email or Telegram when a coin hits your price","footTools":"Tools","brCalcT":"Calculators","brCalcS":"Liquidation, PnL, size & more","brFreeT":"Rewards","brFreeS":"Claim every 5 minutes","brVaultT":"The Vault","brVaultS":"Frames & cosmetics - XP or balance","navBlog":"Blog","navWidgets":"Widgets","navAbout":"About","navContact":"Contact","mnHome":"Home","mnBrowse":"Browse","mnPaper":"Practice","mnTrades":"Trades","mnChat":"Chat","brPages":"Pages & content","navMenu":"Menu","navClose":"Close","secCalc":"Calculators","brHeatT":"Liquidation Heatmap","brHeatS":"Where the leverage sits - 5 minutes free every 12 hours","brSoon":"Soon","subLiq":"Liquidation price","subSize":"Position size","subPnl":"PnL / ROI","subDca":"DCA / average down","subTp":"Take-profit","subRr":"Risk / reward","brSpotT":"Demo Spot","brSpotS":"$10,000 practice card · wallet, memes, 4 chains","brSimT":"Simulators","brSimS":"Stocks, forex, indices & high leverage","brSeasonT":"Your season","brSeasonS":"Pass, boards, daily call & goals","brCompT":"Trading competition","brCompS":"Free entry · prizes every 14 days","brArenaT":"Bot Arena","brArenaS":"Trading bots ranked on live paper trades","brLevelsT":"Level system","brLevelsS":"Bronze to Diamond · XP & perks","brPremT":"Premium","brPremS":"What it unlocks and what it costs","brMapsT":"Liquidation maps","brMapsS":"Where the leverage sits, per coin","brWhaleT":"Whale tracker","brWhaleS":"Biggest Hyperliquid positions & fills","brFundT":"Funding rates","brFundS":"What longs and shorts pay right now","brOiT":"Open interest","brOiS":"How much leverage is open","brLsT":"Long/short ratio","brLsS":"Which side the crowd is on","brCycleT":"Bitcoin cycle","brCycleS":"Pi Cycle, Rainbow & top signals","brJrnT":"Trading journal","brJrnS":"Log every trade and review it","brBtT":"Backtester","brBtS":"Test a strategy on real history","brPivT":"Pivot points","brPivS":"Support & resistance levels","brRorT":"Risk of ruin","brRorS":"The odds your account survives","brCorrT":"Correlation matrix","brCorrS":"What moves together, what does not","brCalT":"Calendar","brCalS":"FOMC, CPI & key crypto dates","brWdgS":"Embed our live data on your site","brAcadT":"Academy","brAcadS":"16 courses, 140 lessons · earn XP","brGuidesT":"Guides","brGuidesS":"Liquidation, leverage & funding explained","brBlogS":"Articles & trading breakdowns","brCommT":"Community","brCommS":"Trader posts, ideas & discussion","brApiT":"Bot API","brApiS":"Test a trading bot free · REST, WS, MCP","brDocsT":"API reference","brDocsS":"Every endpoint, live from the spec","brFapiT":"Free market API","brFapiS":"Prices & liquidations, JSON, no key","brStatT":"Status","brStatS":"Uptime for the API, store & liq feed","brExT":"Compare exchanges","brExS":"Fees, leverage, liquidity & trust","brCmpT":"Comparisons","brCmpS":"How we stack up against other tools","secTradeP":"Trade & practice","secCompete":"Compete & earn","secMarkets":"Live market data","secTools":"Tools","secLearn":"Learn","secDev":"Developers","brLiqT":"Liquidation totals","brLiqS":"24h totals by coin and exchange, and the records"},"de":{"brBrowse":"Entdecken","brSearch":"Seiten, Guides, Coins suchen…","brNoRes":"Keine Treffer für","secNew":"Neu hier?","secTrade":"Handeln","secEarn":"Verdienen","secMore":"Mehr","brWtsT":"Wo anfangen","brWtsS":"Krypto von null - ein kostenloser Einsteigerpfad","prodPaper":"Paper Trade","brPaperS":"Zum Live-Preis üben · null Risiko","brToolsT":"Trading-Tools","brToolsS":"Backtester · Journal · Pivots · Risiko","prodScreener":"Screener","brScrS":"Live-Märkte · Bewegungen, Funding, OI","brMktsT":"Märkte","brMktsS":"Top 100 Coins · Preise & Marktkap.","brDefiT":"DeFi","brDefiS":"TVL, Chains, Protokolle & Stablecoins","brNewsT":"Krypto-News","brNewsS":"Aktuelle Schlagzeilen · live","brFngT":"Angst & Gier","brFngS":"Live-Marktstimmung","prodCharts":"Charts","prodChartsS":"Dein Fenster-Workspace","navRekt":"Rekt","prodRektS":"Live-Liquidationen","brAlertsT":"Preisalarme","brAlertsS":"E-Mail oder Telegram, wenn ein Coin deinen Preis erreicht","footTools":"Tools","brCalcT":"Rechner","brCalcS":"Liquidation, PnL, Größe & mehr","brFreeT":"Gratis USDT","brFreeS":"Alle 5 Minuten beanspruchen","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Über","navContact":"Kontakt","mnHome":"Start","mnBrowse":"Stöbern","mnPaper":"Üben","mnTrades":"Trades","mnChat":"Chat","brPages":"Seiten & Inhalte","navMenu":"Menü","navClose":"Schließen","secCalc":"Rechner","brHeatT":"Liquidations-Heatmap","brHeatS":"Liquidationspools & echte Liqs - live","brSoon":"Bald","subLiq":"Liquidationspreis","subSize":"Positionsgröße","subPnl":"PnL / ROI","subDca":"DCA / Nachkaufen","subTp":"Take-Profit","subRr":"Risiko / Rendite","secTradeP":"Handeln & üben","secCompete":"Wettbewerb & verdienen","secMarkets":"Live-Marktdaten","secTools":"Tools","secLearn":"Lernen","secDev":"Entwickler"},"es":{"brBrowse":"Explorar","brSearch":"Buscar páginas, guías, monedas…","brNoRes":"Sin resultados para","secNew":"¿Nuevo aquí?","secTrade":"Operar","secEarn":"Gana","secMore":"Más","brWtsT":"Por dónde empezar","brWtsS":"Cripto desde cero - una ruta gratuita para principiantes","prodPaper":"Operar en Demo","brPaperS":"Practica al precio en vivo · sin riesgo","brToolsT":"Herramientas de trading","brToolsS":"Backtester · diario · pivotes · riesgo","prodScreener":"Screener","brScrS":"Mercados en vivo · movimientos, funding, OI","brMktsT":"Mercados","brMktsS":"Top 100 monedas · precios y cap. de mercado","brDefiT":"DeFi","brDefiS":"TVL, cadenas, protocolos y stablecoins","brNewsT":"Noticias cripto","brNewsS":"Últimos titulares · en vivo","brFngT":"Miedo y codicia","brFngS":"Sentimiento del mercado en vivo","prodCharts":"Gráficos","prodChartsS":"Tu espacio en ventanas","navRekt":"Rekt","prodRektS":"Liquidaciones en vivo","brAlertsT":"Alertas de precio","brAlertsS":"Email o Telegram cuando una moneda alcance tu precio","footTools":"Herramientas","brCalcT":"Calculadoras","brCalcS":"Liquidación, PnL, tamaño y más","brFreeT":"USDT gratis","brFreeS":"Reclama cada 5 minutos","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Acerca de","navContact":"Contacto","mnHome":"Inicio","mnBrowse":"Explorar","mnPaper":"Practicar","mnTrades":"Trades","mnChat":"Chat","brPages":"Páginas y contenido","navMenu":"Menú","navClose":"Cerrar","secCalc":"Calculadoras","brHeatT":"Mapa de calor de liquidaciones","brHeatS":"Zonas de liquidación y liqs reales - en vivo","brSoon":"Pronto","subLiq":"Precio de liquidación","subSize":"Tamaño de posición","subPnl":"PnL / ROI","subDca":"DCA / promediar a la baja","subTp":"Take-profit","subRr":"Riesgo / beneficio","secTradeP":"Operar y practicar","secCompete":"Compite y gana","secMarkets":"Datos de mercado en vivo","secTools":"Herramientas","secLearn":"Aprende","secDev":"Desarrolladores"},"pt":{"brBrowse":"Explorar","brSearch":"Buscar páginas, guias, moedas…","brNoRes":"Sem resultados para","secNew":"Novo por aqui?","secTrade":"Operar","secEarn":"Ganhe","secMore":"Mais","brWtsT":"Por onde começar","brWtsS":"Cripto do zero - um caminho gratuito para iniciantes","prodPaper":"Operar em Demo","brPaperS":"Pratique no preço ao vivo · risco zero","brToolsT":"Ferramentas de trading","brToolsS":"Backtester · diário · pivôs · risco","prodScreener":"Screener","brScrS":"Mercados ao vivo · variações, funding, OI","brMktsT":"Mercados","brMktsS":"Top 100 moedas · preços e cap. de mercado","brDefiT":"DeFi","brDefiS":"TVL, redes, protocolos e stablecoins","brNewsT":"Notícias cripto","brNewsS":"Últimas manchetes · ao vivo","brFngT":"Medo e ganância","brFngS":"Sentimento do mercado ao vivo","prodCharts":"Gráficos","prodChartsS":"Seu espaço em janelas","navRekt":"Rekt","prodRektS":"Liquidações ao vivo","brAlertsT":"Alertas de preço","brAlertsS":"E-mail ou Telegram quando uma moeda atingir seu preço","footTools":"Ferramentas","brCalcT":"Calculadoras","brCalcS":"Liquidação, PnL, tamanho e mais","brFreeT":"USDT grátis","brFreeS":"Resgate a cada 5 minutos","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Sobre","navContact":"Contato","mnHome":"Início","mnBrowse":"Explorar","mnPaper":"Praticar","mnTrades":"Trades","mnChat":"Chat","brPages":"Páginas e conteúdo","navMenu":"Menu","navClose":"Fechar","secCalc":"Calculadoras","brHeatT":"Mapa de calor de liquidações","brHeatS":"Zonas de liquidação e liqs reais - ao vivo","brSoon":"Em breve","subLiq":"Preço de liquidação","subSize":"Tamanho da posição","subPnl":"PnL / ROI","subDca":"DCA / preço médio","subTp":"Take-profit","subRr":"Risco / retorno","secTradeP":"Operar e praticar","secCompete":"Compita e ganhe","secMarkets":"Dados de mercado ao vivo","secTools":"Ferramentas","secLearn":"Aprenda","secDev":"Desenvolvedores"},"fr":{"brBrowse":"Explorer","brSearch":"Rechercher pages, guides, cryptos…","brNoRes":"Aucun résultat pour","secNew":"Nouveau ici ?","secTrade":"Trader","secEarn":"Gagner","secMore":"Plus","brWtsT":"Par où commencer","brWtsS":"La crypto de zéro - un parcours débutant gratuit","prodPaper":"Trader en Démo","brPaperS":"Pratiquez au prix réel · zéro risque","brToolsT":"Outils de trading","brToolsS":"Backtester · journal · pivots · risque","prodScreener":"Screener","brScrS":"Marchés en direct · variations, funding, OI","brMktsT":"Marchés","brMktsS":"Top 100 cryptos · prix et capitalisation","brDefiT":"DeFi","brDefiS":"TVL, chaînes, protocoles et stablecoins","brNewsT":"Actus crypto","brNewsS":"Derniers titres · en direct","brFngT":"Peur et avidité","brFngS":"Sentiment du marché en direct","prodCharts":"Graphiques","prodChartsS":"Votre espace en fenêtres","navRekt":"Rekt","prodRektS":"Liquidations en direct","brAlertsT":"Alertes de prix","brAlertsS":"E-mail ou Telegram quand une crypto atteint votre prix","footTools":"Outils","brCalcT":"Calculatrices","brCalcS":"Liquidation, PnL, taille et plus","brFreeT":"USDT gratuit","brFreeS":"Réclamez toutes les 5 minutes","navBlog":"Blog","navWidgets":"Widgets","navAbout":"À propos","navContact":"Contact","mnHome":"Accueil","mnBrowse":"Parcourir","mnPaper":"S'entraîner","mnTrades":"Trades","mnChat":"Chat","brPages":"Pages et contenu","navMenu":"Menu","navClose":"Fermer","secCalc":"Calculatrices","brHeatT":"Heatmap des liquidations","brHeatS":"Zones de liquidation et liqs réelles - en direct","brSoon":"Bientôt","subLiq":"Prix de liquidation","subSize":"Taille de position","subPnl":"PnL / ROI","subDca":"DCA / moyenne à la baisse","subTp":"Take-profit","subRr":"Risque / rendement","secTradeP":"Trader & s'entraîner","secCompete":"Concourir & gagner","secMarkets":"Données de marché en direct","secTools":"Outils","secLearn":"Apprendre","secDev":"Développeurs"},"nl":{"brBrowse":"Verkennen","brSearch":"Zoek pagina's, gidsen, coins…","brNoRes":"Geen resultaten voor","secNew":"Nieuw hier?","secTrade":"Handelen","secEarn":"Verdien","secMore":"Meer","brWtsT":"Waar te beginnen","brWtsS":"Crypto vanaf nul - een gratis pad voor beginners","prodPaper":"Paper Trade","brPaperS":"Oefen tegen de live prijs · nul risico","brToolsT":"Trading-tools","brToolsS":"Backtester · dagboek · pivots · risico","prodScreener":"Screener","brScrS":"Live markten · stijgers, funding, OI","brMktsT":"Markten","brMktsS":"Top 100 coins · prijzen & marktkap","brDefiT":"DeFi","brDefiS":"TVL, chains, protocollen & stablecoins","brNewsT":"Crypto-nieuws","brNewsS":"Laatste koppen · live","brFngT":"Angst & hebzucht","brFngS":"Live marktsentiment","prodCharts":"Grafieken","prodChartsS":"Je venster-werkruimte","navRekt":"Rekt","prodRektS":"Live liquidaties","brAlertsT":"Prijsalerts","brAlertsS":"E-mail of Telegram als een coin jouw prijs raakt","footTools":"Tools","brCalcT":"Calculators","brCalcS":"Liquidatie, PnL, omvang & meer","brFreeT":"Gratis USDT","brFreeS":"Claim elke 5 minuten","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Over","navContact":"Contact","mnHome":"Home","mnBrowse":"Bladeren","mnPaper":"Oefenen","mnTrades":"Trades","mnChat":"Chat","brPages":"Pagina's & inhoud","navMenu":"Menu","navClose":"Sluiten","secCalc":"Calculators","brHeatT":"Liquidatie-heatmap","brHeatS":"Liquidatiepools & echte liqs - live","brSoon":"Binnenkort","subLiq":"Liquidatieprijs","subSize":"Positiegrootte","subPnl":"PnL / ROI","subDca":"DCA / bijkopen","subTp":"Take-profit","subRr":"Risico / rendement","secTradeP":"Handelen & oefenen","secCompete":"Strijden & verdienen","secMarkets":"Live marktdata","secTools":"Tools","secLearn":"Leren","secDev":"Ontwikkelaars"},"ru":{"brBrowse":"Обзор","brSearch":"Поиск страниц, гайдов, монет…","brNoRes":"Нет совпадений для","secNew":"Впервые здесь?","secTrade":"Торговля","secEarn":"Заработок","secMore":"Ещё","brWtsT":"С чего начать","brWtsS":"Крипто с нуля - бесплатный путь для новичков","prodPaper":"Демо-торговля","brPaperS":"Практика по реальной цене · без риска","brToolsT":"Торговые инструменты","brToolsS":"Бэктестер · журнал · пивоты · риск","prodScreener":"Скринер","brScrS":"Рынки в реальном времени · движения, фандинг, OI","brMktsT":"Рынки","brMktsS":"Топ-100 монет · цены и капитализация","brDefiT":"DeFi","brDefiS":"TVL, сети, протоколы и стейблкоины","brNewsT":"Крипто-новости","brNewsS":"Последние заголовки · в реальном времени","brFngT":"Страх и жадность","brFngS":"Настроение рынка в реальном времени","prodCharts":"Графики","prodChartsS":"Ваше оконное рабочее место","navRekt":"Rekt","prodRektS":"Лента ликвидаций в реальном времени","brAlertsT":"Ценовые оповещения","brAlertsS":"E-mail или Telegram, когда монета достигнет вашей цены","footTools":"Инструменты","brCalcT":"Калькуляторы","brCalcS":"Ликвидация, PnL, размер и не только","brFreeT":"Бесплатный USDT","brFreeS":"Забирайте каждые 5 минут","navBlog":"Блог","navWidgets":"Виджеты","navAbout":"О нас","navContact":"Контакты","mnHome":"Главная","mnBrowse":"Обзор","mnPaper":"Практика","mnTrades":"Сделки","mnChat":"Чат","brPages":"Страницы и контент","navMenu":"Меню","navClose":"Закрыть","secCalc":"Калькуляторы","brHeatT":"Тепловая карта ликвидаций","brHeatS":"Зоны ликвидаций и реальные ликвидации - live","brSoon":"Скоро","subLiq":"Цена ликвидации","subSize":"Размер позиции","subPnl":"PnL / ROI","subDca":"DCA / усреднение","subTp":"Тейк-профит","subRr":"Риск / прибыль","secTradeP":"Торговля и практика","secCompete":"Соревнования и награды","secMarkets":"Данные рынка в реальном времени","secTools":"Инструменты","secLearn":"Обучение","secDev":"Разработчикам"},"tr":{"brBrowse":"Keşfet","brSearch":"Sayfa, rehber, coin ara…","brNoRes":"Sonuç yok:","secNew":"Yeni misin?","secTrade":"İşlem","secEarn":"Kazan","secMore":"Daha fazla","brWtsT":"Nereden başlamalı","brWtsS":"Sıfırdan kripto - ücretsiz başlangıç yolu","prodPaper":"Demo İşlem","brPaperS":"Canlı fiyattan pratik yap · sıfır risk","brToolsT":"İşlem araçları","brToolsS":"Backtester · günlük · pivotlar · risk","prodScreener":"Tarayıcı","brScrS":"Canlı piyasalar · hareketler, funding, OI","brMktsT":"Piyasalar","brMktsS":"İlk 100 coin · fiyatlar ve piyasa değeri","brDefiT":"DeFi","brDefiS":"TVL, zincirler, protokoller ve stablecoinler","brNewsT":"Kripto haberleri","brNewsS":"Son başlıklar · canlı","brFngT":"Korku ve açgözlülük","brFngS":"Canlı piyasa duyarlılığı","prodCharts":"Grafikler","prodChartsS":"Pencereli çalışma alanınız","navRekt":"Rekt","prodRektS":"Canlı likidasyon akışı","brAlertsT":"Fiyat alarmları","brAlertsS":"Bir coin fiyatına ulaşınca e-posta veya Telegram","footTools":"Araçlar","brCalcT":"Hesaplayıcılar","brCalcS":"Likidasyon, PnL, boyut ve daha fazlası","brFreeT":"Ücretsiz USDT","brFreeS":"Her 5 dakikada bir al","navBlog":"Blog","navWidgets":"Widget'lar","navAbout":"Hakkında","navContact":"İletişim","mnHome":"Ana Sayfa","mnBrowse":"Gözat","mnPaper":"Pratik","mnTrades":"İşlemler","mnChat":"Sohbet","brPages":"Sayfalar ve içerik","navMenu":"Menü","navClose":"Kapat","secCalc":"Hesaplayıcılar","brHeatT":"Likidasyon ısı haritası","brHeatS":"Likidasyon havuzları ve gerçek liq’ler - canlı","brSoon":"Yakında","subLiq":"Likidasyon fiyatı","subSize":"Pozisyon boyutu","subPnl":"PnL / ROI","subDca":"DCA / ortalama düşürme","subTp":"Kâr al","subRr":"Risk / ödül","secTradeP":"İşlem ve pratik","secCompete":"Yarış ve kazan","secMarkets":"Canlı piyasa verileri","secTools":"Araçlar","secLearn":"Öğren","secDev":"Geliştiriciler"},"zh":{"brBrowse":"浏览","brSearch":"搜索页面、指南、币种…","brNoRes":"未找到","secNew":"新手？","secTrade":"交易","secEarn":"赚取","secMore":"更多","brWtsT":"从何开始","brWtsS":"从零开始学加密 - 免费新手路径","prodPaper":"模拟交易","brPaperS":"按实时价格练习 · 零风险","brToolsT":"交易工具","brToolsS":"回测 · 日志 · 枢轴点 · 风险","prodScreener":"选币器","brScrS":"实时行情 · 涨跌、资金费率、持仓量","brMktsT":"行情","brMktsS":"前100币种 · 价格与市值","brDefiT":"DeFi","brDefiS":"TVL、链、协议与稳定币","brNewsT":"加密新闻","brNewsS":"最新头条 · 实时","brFngT":"恐惧与贪婪","brFngS":"实时市场情绪","prodCharts":"图表","prodChartsS":"你的窗口化工作区","navRekt":"爆仓","prodRektS":"实时强平动态","brAlertsT":"价格提醒","brAlertsS":"币种达到你的价格时邮件或 Telegram 通知","footTools":"工具","brCalcT":"计算器","brCalcS":"强平、盈亏、仓位大小等","brFreeT":"免费 USDT","brFreeS":"每5分钟领取","navBlog":"博客","navWidgets":"小组件","navAbout":"关于","navContact":"联系","mnHome":"首页","mnBrowse":"浏览","mnPaper":"练习","mnTrades":"交易","mnChat":"聊天","brPages":"页面与内容","navMenu":"菜单","navClose":"关闭","secCalc":"计算器","brHeatT":"强平热力图","brHeatS":"强平区域与实时强平 - 实时","brSoon":"即将推出","subLiq":"强平价格","subSize":"仓位大小","subPnl":"盈亏 / ROI","subDca":"定投 / 摊低成本","subTp":"止盈","subRr":"风险 / 回报","secTradeP":"交易与练习","secCompete":"竞赛与奖励","secMarkets":"实时市场数据","secTools":"工具","secLearn":"学习","secDev":"开发者"},"ja":{"brBrowse":"見る","brSearch":"ページ・ガイド・銘柄を検索…","brNoRes":"該当なし:","secNew":"はじめての方へ","secTrade":"取引","secEarn":"稼ぐ","secMore":"その他","brWtsT":"どこから始める","brWtsS":"ゼロから学ぶ暗号資産 - 無料の初心者ガイド","prodPaper":"ペーパートレード","brPaperS":"ライブ価格で練習 · リスクゼロ","brToolsT":"トレードツール","brToolsS":"バックテスト · 日誌 · ピボット · リスク","prodScreener":"スクリーナー","brScrS":"ライブ市場 · 値動き、資金調達率、OI","brMktsT":"マーケット","brMktsS":"トップ100銘柄 · 価格と時価総額","brDefiT":"DeFi","brDefiS":"TVL、チェーン、プロトコル、ステーブルコイン","brNewsT":"暗号資産ニュース","brNewsS":"最新ヘッドライン · ライブ","brFngT":"恐怖と強欲","brFngS":"ライブ市場センチメント","prodCharts":"チャート","prodChartsS":"ウィンドウ式ワークスペース","navRekt":"清算","prodRektS":"ライブ清算フィード","brAlertsT":"価格アラート","brAlertsS":"銘柄が指定価格に達したらメールまたはTelegramで通知","footTools":"ツール","brCalcT":"計算ツール","brCalcS":"清算・損益・数量など","brFreeT":"無料USDT","brFreeS":"5分ごとに受け取り","navBlog":"ブログ","navWidgets":"ウィジェット","navAbout":"概要","navContact":"お問い合わせ","mnHome":"ホーム","mnBrowse":"見る","mnPaper":"練習","mnTrades":"取引","mnChat":"チャット","brPages":"ページとコンテンツ","navMenu":"メニュー","navClose":"閉じる","secCalc":"計算ツール","brHeatT":"清算ヒートマップ","brHeatS":"清算プールとリアル清算 - ライブ","brSoon":"近日公開","subLiq":"清算価格","subSize":"ポジションサイズ","subPnl":"損益 / ROI","subDca":"DCA / ナンピン","subTp":"利確","subRr":"リスク / リワード","secTradeP":"取引と練習","secCompete":"大会と報酬","secMarkets":"ライブ市場データ","secTools":"ツール","secLearn":"学ぶ","secDev":"開発者"},"ko":{"brBrowse":"둘러보기","brSearch":"페이지·가이드·코인 검색…","brNoRes":"검색 결과 없음:","secNew":"처음이신가요?","secTrade":"거래","secEarn":"적립","secMore":"더보기","brWtsT":"어디서 시작할까","brWtsS":"제로부터 배우는 크립토 - 무료 입문 코스","prodPaper":"모의 거래","brPaperS":"실시간 가격으로 연습 · 무위험","brToolsT":"트레이딩 도구","brToolsS":"백테스터 · 일지 · 피벗 · 리스크","prodScreener":"스크리너","brScrS":"실시간 시장 · 변동, 펀딩, OI","brMktsT":"마켓","brMktsS":"상위 100 코인 · 가격과 시가총액","brDefiT":"DeFi","brDefiS":"TVL, 체인, 프로토콜, 스테이블코인","brNewsT":"크립토 뉴스","brNewsS":"최신 헤드라인 · 실시간","brFngT":"공포와 탐욕","brFngS":"실시간 시장 심리","prodCharts":"차트","prodChartsS":"창 분할 작업공간","navRekt":"청산","prodRektS":"실시간 청산 피드","brAlertsT":"가격 알림","brAlertsS":"코인이 지정 가격에 도달하면 이메일 또는 텔레그램","footTools":"도구","brCalcT":"계산기","brCalcS":"청산, 손익, 규모 등","brFreeT":"무료 USDT","brFreeS":"5분마다 받기","navBlog":"블로그","navWidgets":"위젯","navAbout":"소개","navContact":"문의","mnHome":"홈","mnBrowse":"둘러보기","mnPaper":"연습","mnTrades":"거래","mnChat":"채팅","brPages":"페이지 및 콘텐츠","navMenu":"메뉴","navClose":"닫기","secCalc":"계산기","brHeatT":"청산 히트맵","brHeatS":"청산 풀과 실시간 청산 - 라이브","brSoon":"곧 출시","subLiq":"청산 가격","subSize":"포지션 규모","subPnl":"손익 / ROI","subDca":"DCA / 물타기","subTp":"익절","subRr":"위험 / 보상","secTradeP":"거래와 연습","secCompete":"경쟁과 보상","secMarkets":"실시간 시장 데이터","secTools":"도구","secLearn":"학습","secDev":"개발자"},"ar":{"brBrowse":"تصفح","brSearch":"ابحث عن صفحات وأدلة وعملات…","brNoRes":"لا نتائج لـ","secNew":"جديد هنا؟","secTrade":"تداول","secEarn":"اربح","secMore":"المزيد","brWtsT":"من أين تبدأ","brWtsS":"العملات الرقمية من الصفر - مسار مجاني للمبتدئين","prodPaper":"تداول تجريبي","brPaperS":"تدرّب بالسعر المباشر · بدون مخاطر","brToolsT":"أدوات التداول","brToolsS":"اختبار رجعي · سجل · نقاط محورية · مخاطر","prodScreener":"الماسح","brScrS":"أسواق مباشرة · التحركات والتمويل والمراكز المفتوحة","brMktsT":"الأسواق","brMktsS":"أفضل 100 عملة · الأسعار والقيمة السوقية","brDefiT":"DeFi","brDefiS":"القيمة المقفلة والشبكات والبروتوكولات والعملات المستقرة","brNewsT":"أخبار الكريبتو","brNewsS":"أحدث العناوين · مباشر","brFngT":"الخوف والطمع","brFngS":"مزاج السوق المباشر","prodCharts":"الرسوم البيانية","prodChartsS":"مساحة عملك المنبثقة","navRekt":"تصفيات","prodRektS":"بث التصفيات الحي","brAlertsT":"تنبيهات السعر","brAlertsS":"بريد إلكتروني أو تيليجرام عند وصول العملة إلى سعرك","footTools":"الأدوات","brCalcT":"الحاسبات","brCalcS":"التصفية والربح/الخسارة والحجم والمزيد","brFreeT":"USDT مجاني","brFreeS":"احصل كل 5 دقائق","navBlog":"المدونة","navWidgets":"الأدوات المصغّرة","navAbout":"حول","navContact":"تواصل","mnHome":"الرئيسية","mnBrowse":"تصفّح","mnPaper":"تدرّب","mnTrades":"الصفقات","mnChat":"دردشة","brPages":"الصفحات والمحتوى","navMenu":"القائمة","navClose":"إغلاق","secCalc":"الحاسبات","brHeatT":"خريطة حرارية للتصفيات","brHeatS":"تجمعات التصفية وتصفيات حقيقية - مباشر","brSoon":"قريباً","subLiq":"سعر التصفية","subSize":"حجم المركز","subPnl":"الربح/الخسارة / العائد","subDca":"متوسط التكلفة / التعزيز","subTp":"جني الأرباح","subRr":"المخاطرة / العائد","secTradeP":"التداول والتدريب","secCompete":"المنافسة والأرباح","secMarkets":"بيانات السوق المباشرة","secTools":"الأدوات","secLearn":"تعلّم","secDev":"المطوّرون"},"id":{"brBrowse":"Jelajahi","brSearch":"Cari halaman, panduan, koin…","brNoRes":"Tidak ada hasil untuk","secNew":"Baru di sini?","secTrade":"Trading","secEarn":"Hasilkan","secMore":"Lainnya","brWtsT":"Mulai dari mana","brWtsS":"Kripto dari nol - jalur pemula gratis","prodPaper":"Paper Trade","brPaperS":"Berlatih di harga live · tanpa risiko","brToolsT":"Alat trading","brToolsS":"Backtester · jurnal · pivot · risiko","prodScreener":"Screener","brScrS":"Pasar live · pergerakan, funding, OI","brMktsT":"Pasar","brMktsS":"100 koin teratas · harga & kap. pasar","brDefiT":"DeFi","brDefiS":"TVL, chain, protokol & stablecoin","brNewsT":"Berita kripto","brNewsS":"Berita terbaru · live","brFngT":"Takut & serakah","brFngS":"Sentimen pasar live","prodCharts":"Grafik","prodChartsS":"Ruang kerja berjendela","navRekt":"Rekt","prodRektS":"Feed likuidasi live","brAlertsT":"Peringatan harga","brAlertsS":"Email atau Telegram saat koin mencapai harga Anda","footTools":"Alat","brCalcT":"Kalkulator","brCalcS":"Likuidasi, PnL, ukuran & lainnya","brFreeT":"USDT gratis","brFreeS":"Klaim tiap 5 menit","navBlog":"Blog","navWidgets":"Widget","navAbout":"Tentang","navContact":"Kontak","mnHome":"Beranda","mnBrowse":"Jelajah","mnPaper":"Latihan","mnTrades":"Trade","mnChat":"Chat","brPages":"Halaman & konten","navMenu":"Menu","navClose":"Tutup","secCalc":"Kalkulator","brHeatT":"Heatmap likuidasi","brHeatS":"Zona likuidasi & liq nyata - live","brSoon":"Segera","subLiq":"Harga likuidasi","subSize":"Ukuran posisi","subPnl":"PnL / ROI","subDca":"DCA / average down","subTp":"Take-profit","subRr":"Risiko / imbalan","secTradeP":"Trading & latihan","secCompete":"Kompetisi & hasil","secMarkets":"Data pasar live","secTools":"Alat","secLearn":"Belajar","secDev":"Pengembang"}};
  function _mpLang(){var m=(location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)||[])[1];if(m&&MPI[m])return m;try{var u=new URLSearchParams(location.search).get('lang');if(u&&MPI[u])return u;}catch(e){}try{var sv=localStorage.getItem('mp_lang');if(sv&&MPI[sv])return sv;}catch(e){}return 'en';}
  var _NL=_mpLang();
  function TR(k){var o=MPI[_NL]||MPI.en;return (o&&o[k]!=null)?o[k]:(MPI.en[k]!=null?MPI.en[k]:k);}
  var css = ''
    /* cross-page crossfade: DESKTOP-only. On phones the old-page snapshot lingers while the new page renders
       (reads as "the previous page flashes back" on slow devices) and the snapshot compositing costs GPU on
       weak phones - so mobile navigates instantly instead. Desktop gets a short .15s fade. */
    + (window.matchMedia && window.matchMedia('(min-width:721px)').matches ? '@view-transition{navigation:auto;}::view-transition-old(root),::view-transition-new(root){animation-duration:.15s;}' : '')
    + '.mpnav-burger{display:none;position:fixed;top:13px;left:13px;z-index:90;flex-direction:column;justify-content:center;gap:4px;width:38px;height:38px;padding:0 8px;background:rgba(10,11,13,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:10px;cursor:pointer;}'
    + '.mpnav-burger span{display:block;height:2.5px;width:20px;border-radius:2px;background:#c2f64a;box-shadow:0 0 6px rgba(194,246,74,.5);transition:.2s;}'
    + '.mpnav-burger span:nth-child(2){width:14px;}'
    + '.mpnav-burger:hover span{box-shadow:0 0 10px rgba(194,246,74,.9);width:20px;}'
    + '@media(min-width:721px){.mpnav-burger{display:inline-flex;}header .brand{margin-left:46px;}}'  /* burger (drawer access) is DESKTOP-only now - on mobile the bottom bar has Browse, and the fixed burger was covering the logo */
    + '.mpnav{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,0);transition:background .3s;}'
    + '.mpnav[hidden]{display:none;}'
    + '.mpnav.open{background:rgba(0,0,0,.5);}'
    + '.mpnav-sheet{position:absolute;inset:0 auto 0 0;width:min(372px,86vw);background:linear-gradient(180deg,#0d0f13,#0a0b0d);border-right:1px solid rgba(255,255,255,.14);box-shadow:0 0 50px rgba(0,0,0,.6);transform:translateX(-100%);transition:transform .3s cubic-bezier(.2,.85,.25,1);display:flex;flex-direction:column;}'
    + '.mpnav.open .mpnav-sheet{transform:translateX(0);}'
    + '.mpnav-head{display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top) + 16px) 20px 8px;}'
    + ".mpnav-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:24px;letter-spacing:-.02em;color:#e9e7df;}"
    + '.mpnav-x{width:36px;height:36px;border-radius:50%;background:#111419;border:1px solid #2f3742;color:#e9e7df;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;}'
    + '.mpnav-sw{padding:2px 18px 8px;}'
    + ".mpnav-search{width:100%;box-sizing:border-box;background:#111419;border:1px solid #2f3742;border-radius:11px;padding:11px 14px;color:#e9e7df;font-size:15px;font-family:'Familjen Grotesk',system-ui,sans-serif;outline:none;transition:border-color .15s;}"
    + '.mpnav-search:focus{border-color:#c2f64a;}.mpnav-search::placeholder{color:#5c656f;}'
    + '.mpnav-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px 14px calc(env(safe-area-inset-bottom) + 26px);}'
    + '.mpnav-scroll{scrollbar-width:thin;scrollbar-color:#1c222b transparent;}'
    + '.mpnav-scroll::-webkit-scrollbar{width:6px;}'
    + '.mpnav-scroll::-webkit-scrollbar-track{background:transparent;}'
    + '.mpnav-scroll::-webkit-scrollbar-thumb{background:#1c222b;border-radius:99px;}'
    + '.mpnav-scroll::-webkit-scrollbar-thumb:hover{background:#2c3540;}'
    + ".mpnav-sec{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#5c656f;margin:14px 6px 7px;}"
    /* ROW HEIGHT IS A BUDGET, NOT A TASTE (2026-09-15). Eight sections hold 15 destinations the old five never
       showed, and at the old 77px per row that was 5.47 screens of scrolling on a 390px phone against 3.6
       before - a menu you have to scroll five times is not organised, however well it is grouped. 63px per row
       buys back 672px; the two link-list sections below use the compact chip grid for the rest. */
    + '.mpnav-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:#111419;border:1px solid #232932;border-radius:13px;padding:11px 14px;margin-bottom:7px;color:#e9e7df;text-decoration:none;transition:transform .12s,background .12s;}'
    + '.mpnav-hot{border:1px solid rgba(194,246,74,.4)!important;border-radius:12px;animation:mphot 2.4s ease-in-out infinite}.mpnav-hot .mpnav-ic{animation:mphotIc 2.4s ease-in-out infinite}.mpnav-hotb{font-style:normal;font-family:monospace;font-size:8.5px;font-weight:800;letter-spacing:.08em;background:#c2f64a;color:#0a0b0d;border-radius:5px;padding:1.5px 5px;vertical-align:2px;margin-left:5px}@keyframes mphot{0%,100%{box-shadow:0 0 0 0 rgba(194,246,74,.0),0 0 14px -6px rgba(194,246,74,.45)}50%{box-shadow:0 0 0 1px rgba(194,246,74,.25),0 0 22px -4px rgba(194,246,74,.7)}}@keyframes mphotIc{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}.mpnav-row:hover{background:#161a20;}.mpnav-row:active{transform:scale(.985);}'
    + '.mpnav-ic{flex-shrink:0;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;}.mpnav-ic svg{width:19px;height:19px;display:block;}'
    + '.mpnav-rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}'
    + ".mpnav-rt b{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;}"
    + '.mpnav-rt small{color:#7f8893;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    /* A CHIP GRID IS A GROUP, SO IT NEEDS MORE AIR AROUND IT THAN THE 7px BETWEEN ROWS (owner 2026-09-15:
       "long short ratio i fear & greed su jako blizu sa karticom Markets", same for About/Contact vs
       Comparisons). With no margin of its own the last chip line sat 0px from the full row underneath, so the
       chips read as part of it. 15px below, 4px above = the group reads as one block, not as a ragged tail. */
    + '.mpnav-more{display:flex;flex-wrap:wrap;gap:7px;margin:4px 0 15px;}'
    + '.mpnav-mrow{flex:1 1 calc(50% - 8px);display:flex;align-items:center;gap:9px;background:#111419;border:1px solid #232932;border-radius:12px;padding:11px 12px;color:#9aa3ad;text-decoration:none;font-size:14px;}'
    + '.mpnav-mrow svg{width:16px;height:16px;flex:0 0 auto;color:#7f8893;}'
    + '.mpnav-mrow:hover{color:#e9e7df;}'
    /* expandable Calculators row + sub-links, disabled "Soon" row, Soon/New badges - match the homepage Browse */
    + '.mpnav-expand{cursor:pointer;}'
    + '.mpnav-expand .mpnav-rt{flex:1;}'
    + '.mpnav-expand>svg:last-child{transition:transform .18s;}'
    + '.mpnav-expand.open>svg:last-child{transform:rotate(90deg);}'
    + '.mpnav-sub{display:flex;flex-direction:column;gap:6px;margin:-3px 0 9px;padding-left:54px;}'
    + '.mpnav-sub[hidden]{display:none;}'
    + ".mpnav-subrow{display:block;color:#9aa3ad;text-decoration:none;font-size:13.5px;padding:9px 12px;border:1px solid #232932;border-radius:10px;background:#0e1116;font-family:'Familjen Grotesk',system-ui,sans-serif;}"
    + '.mpnav-subrow:hover{color:#e9e7df;border-color:#2f3742;}'
    + '.mpnav-soon{opacity:.5;cursor:default;pointer-events:none;}'
    + ".mpnav-badge{font-style:normal;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#ffb347;border:1px solid rgba(255,179,71,.4);border-radius:5px;padding:1px 5px;margin-left:5px;vertical-align:middle;}"
    + '.mpnav-nores{color:#5c656f;text-align:center;padding:24px 0;font-size:14px;}'
    + '.mpnav-sugg[hidden]{display:none;}'
    + '.mpnav-sg{display:flex;align-items:center;gap:10px;background:#111419;border:1px solid #232932;border-radius:11px;padding:11px 13px;margin-bottom:7px;color:#e9e7df;text-decoration:none;}'
    + '.mpnav-sg svg{flex:0 0 auto;color:#7f8893;}'
    + '.mpnav-sg span{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.mpnav-sg small{flex:0 0 auto;color:#5c656f;font-family:\'Space Mono\',monospace;font-size:10px;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    /* ===== homepage-style bottom mobile nav bar (mobile only) - gives every standalone page the same nav as the homepage ===== */
    + '.mpbn{display:none;}'
    + '@media(max-width:720px){'
    +   '.mpbn{position:fixed;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom) + 9px);z-index:55;display:flex;justify-content:space-around;align-items:center;padding:9px 6px;border-radius:20px;background:rgba(9,13,10,.6);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(194,246,74,.22);box-shadow:0 10px 34px -12px rgba(0,0,0,.75),0 0 20px -8px rgba(194,246,74,.3);}'
    +   '.mpbn a{flex:1;background:none;border:none;color:rgba(255,255,255,.62);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:2px 0;text-decoration:none;transition:transform .12s,color .12s;-webkit-tap-highlight-color:transparent;}'
    +   '.mpbn a:active{color:#c2f64a;transform:scale(.86);}'
    +   '.mpbn a.cur{color:#c2f64a;}'
    +   '.mpbn svg{width:21px;height:21px;}'
    +   '.mpbn .mpbn-l{font-family:\'Space Mono\',monospace;font-size:9px;letter-spacing:.03em;text-transform:uppercase;line-height:1;}'
    +   'body{padding-bottom:calc(84px + env(safe-area-inset-bottom)) !important;}'
    +   'header .nav{display:none !important;}'   /* the cramped desktop header links are replaced by the drawer + bottom bar on mobile */
    /* fixed, notch-safe top header (the default header sat under the iPhone notch with viewport-fit=cover). Full-bleed via the 100vw trick so the bg spans edge-to-edge regardless of the .wrap padding. */
    +   'body>.wrap>header,body>header{position:sticky;top:0;z-index:50;padding-top:calc(env(safe-area-inset-top) + 14px) !important;padding-bottom:12px !important;background:#0a0b0d;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:6px;}'   /* solid bg (no 100vw / no backdrop-filter - both are iOS WebKit hazards) */
    +   'body>.wrap>header .brand,body>header .brand{margin-left:0;}'   /* no burger on mobile → logo sits at its natural left edge */
    +   '.mpnav-burger{top:calc(env(safe-area-inset-top) + 9px);}'
    + '}';
  // WEAK-PHONE GPU RESCUE: kill backdrop-filter:blur on mobile (old WebViews freeze the compositor on blurred elements). Solid bottom bar for legibility.
  css += '@media(max-width:760px){*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}.mpbn{background:#0c1109 !important;}}';
  // ===== canonical desktop header (homepage-identical) for standalone pages that lack it - applied by normalizeHeader() =====
  css += 'header.mpnav-hdr{display:flex !important;align-items:center;justify-content:space-between;gap:14px;}'
    + 'header.mpnav-hdr .brand{display:flex;align-items:baseline;gap:10px;margin-left:0 !important;}'
    + "header.mpnav-hdr .mark{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:22px;letter-spacing:-.04em;color:#e9e7df;text-decoration:none;cursor:pointer;line-height:1;}"
    + 'header.mpnav-hdr .mark b{color:#c2f64a;}'
    + 'header.mpnav-hdr .hmenu{display:inline-flex;flex-direction:column;justify-content:center;gap:4px;width:30px;height:30px;padding:0 6px;background:none;border:none;cursor:pointer;align-self:center;}'
    + 'header.mpnav-hdr .hmenu span{display:block;height:2.5px;width:18px;border-radius:2px;background:#c2f64a;box-shadow:0 0 6px rgba(194,246,74,.5);transition:.2s;}'
    + 'header.mpnav-hdr .hmenu span:nth-child(2){width:13px;}'
    + 'header.mpnav-hdr .hmenu:hover span{box-shadow:0 0 10px rgba(194,246,74,.9);width:18px;}'
    + 'header.mpnav-hdr .hnav{display:flex;align-items:center;gap:3px;}'
    + "header.mpnav-hdr .hlink{display:inline-flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8b95a1;text-decoration:none;background:transparent;border:none;cursor:pointer;padding:7px 9px;border-radius:9px;transition:.15s;}"
    + 'header.mpnav-hdr .hlink:hover{color:#fff;background:rgba(255,255,255,.07);}'
    + 'header.mpnav-hdr .hlink svg{flex-shrink:0;}'
    + 'header.mpnav-hdr .hbot{color:#7cc4ff;}header.mpnav-hdr .hrwd,header.mpnav-hdr .hjr{color:#c2f64a;}'
    + "header.mpnav-hdr .lang{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.04em;color:#8b95a1;background:#0a0b0d;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:7px 9px;cursor:pointer;outline:none;max-width:140px;}"
    + '@media(max-width:720px){header.mpnav-hdr .hbot,header.mpnav-hdr .hjr{display:none;}header.mpnav-hdr .hauth span{display:none;}header.mpnav-hdr .hauth{padding:9px;min-width:40px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;}header.mpnav-hdr .hnav{gap:2px;}header.mpnav-hdr .lang{max-width:64px;}}'
    /* desktop: full-bleed sticky bar like the homepage (pages put their header inside a centered .wrap - break out) */
    + '@media(min-width:721px){html{overflow-x:clip;}header.mpnav-hdr{width:100vw;margin-left:calc(50% - 50vw);padding:15px 28px;box-sizing:border-box;position:sticky;top:0;z-index:50;background:rgba(11,13,18,.82);-webkit-backdrop-filter:blur(10px) saturate(1.2);backdrop-filter:blur(10px) saturate(1.2);border-bottom:1px solid rgba(255,255,255,.09);}}'
    /* site-wide header tweaks (apply to canonical + injected headers): bigger account icon, language as a transparent globe */
    + 'header .hlink.hauth svg,header .hauth svg{width:17px !important;height:17px !important}'
    + 'header .lang{-webkit-appearance:none;-moz-appearance:none;appearance:none !important;width:32px !important;min-width:32px !important;max-width:32px !important;height:30px;padding:0 !important;color:transparent !important;text-shadow:none !important;background-color:transparent !important;border:1px solid transparent !important;border-radius:8px;background-repeat:no-repeat !important;background-position:center !important;background-size:19px 19px !important;background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%23aab3bf%27%20stroke-width%3D%271.7%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Ccircle%20cx%3D%2712%27%20cy%3D%2712%27%20r%3D%279%27%2F%3E%3Cline%20x1%3D%273%27%20y1%3D%2712%27%20x2%3D%2721%27%20y2%3D%2712%27%2F%3E%3Cpath%20d%3D%27M12%203a15%2015%200%200%201%200%2018%2015%2015%200%200%201%200-18%27%2F%3E%3C%2Fsvg%3E") !important;cursor:pointer}'
    + 'header .lang option{color:#e7ecf2;background:#12161c}'
    + 'header .htg{color:#229ed9 !important}header .htg:hover{color:#3bb0e8 !important;background:rgba(34,158,217,.14)}header .htg svg{display:block}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ===== ICON SET =====
  // Path data only; SV() wraps every one identically, so the whole drawer shares one stroke weight, one cap
  // style and one optical size. EVERY ROW HAS ITS OWN ICON - before 2026-09-15 six icons were shared by
  // thirteen rows (bullseye = Paper Trade + Simulators, pie = Coins + Whales + Exchanges, flame = Rekt +
  // Liquidations today, star = Levels + "Best paper trading", brackets = Bot API + the retired /api/, line
  // chart = Charts + Bitcoin cycle), so the icon told you nothing about where a row went.
  function SV(p, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || '1.9') + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var PT = {
    /* trade & practice */
    plan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    spot: '<rect x="2" y="7" width="20" height="13" rx="2.5"/><path d="M16 13.5h4"/><path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V7"/>',
    charts: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
    scr: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3.5" y1="6" x2="3.51" y2="6"/><line x1="3.5" y1="12" x2="3.51" y2="12"/><line x1="3.5" y1="18" x2="3.51" y2="18"/>',
    sim: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M6.5 13l3-3.5 2.5 2.5 4.5-5"/><path d="M9 20h6"/><path d="M12 17v3"/>',
    /* compete & earn */
    trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0z"/><path d="M7 5H4.5a2.5 2.5 0 0 0 2.6 4.9"/><path d="M17 5h2.5a2.5 2.5 0 0 1-2.6 4.9"/><path d="M12 14v3"/><path d="M8.5 21h7"/><path d="M9.5 21c0-2 1-2.6 2.5-4 1.5 1.4 2.5 2 2.5 4"/>',
    ranks: '<path d="M4 6.5h9"/><path d="M4 12h13"/><path d="M4 17.5h6"/><circle cx="18.5" cy="6.5" r="2"/><path d="M18.5 10.5v7"/><path d="M16.5 15.5l2 2 2-2"/>',
    podium: '<rect x="9.4" y="8" width="5.2" height="12" rx="1"/><rect x="2.8" y="12" width="5.2" height="8" rx="1"/><rect x="16" y="15" width="5.2" height="5" rx="1"/><path d="M12 8V3.2"/><path d="M12 3.4l3 1.1-3 1.1z" fill="currentColor" stroke="none"/>',
    arena: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4.6V8"/><circle cx="12" cy="3.4" r="1.2"/><path d="M9.2 12.4v1.6M14.8 12.4v1.6"/><path d="M2.4 13v3M21.6 13v3"/>',
    gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    vault: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.4"/><path d="M12 8.6v-1M12 16.4v-1M8.6 12h-1M16.4 12h-1"/>',
    starr: '<polygon points="12 2 15 8.5 22 9.3 17 14 18.3 21 12 17.5 5.7 21 7 14 2 9.3 9 8.5 12 2"/>',
    crown: '<path d="M3.2 17.6h17.6"/><path d="M3.6 7.4l3.3 3.2L12 4.4l5.1 6.2 3.3-3.2-1.4 9.6H5L3.6 7.4z"/>',
    /* live market data */
    rekt: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    heat: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M15.7 9.7h4.6v4.6h-4.6z" fill="currentColor" stroke="none"/>',
    map: '<path d="M9 3.5 3.5 5.6v15L9 18.4l6 2.1 5.5-2.1v-15L15 5.6 9 3.5z"/><path d="M9 3.5v14.9M15 5.6v14.9"/>',
    /* body + fluke + spout. The first cut was a single closed curve with an eye inside it and at 19px it read as
       an EYE, not a whale - an icon has to survive the size it actually ships at, so it was redrawn from the
       screenshot, not from the path data. */
    whale: '<path d="M2.6 12.4c0 3.4 2.8 6.2 6.2 6.2h5.4c2.5 0 4.6-2.1 4.6-4.6s-2.1-4.6-4.6-4.6c-4.6 0-6.1 3-11.6 3z"/><path d="M18.6 13.2c1.3-.4 2.4-1.4 3.1-2.7-1.7-.5-3-.2-3.9.5"/><path d="M11.2 7.3c.3-1.2 1.3-2.1 2.5-2.3"/><circle cx="7.9" cy="13" r=".95" fill="currentColor" stroke="none"/>',
    funding: '<path d="M20 12a8 8 0 0 1-8 8"/><path d="M4 12a8 8 0 0 1 8-8"/><path d="M17.6 3.9v3.7h-3.7"/><path d="M6.4 20.1v-3.7h3.7"/><circle cx="9.9" cy="9.9" r="1.25"/><circle cx="14.1" cy="14.1" r="1.25"/><path d="M15.2 8.8l-6.4 6.4"/>',
    oi: '<path d="M4 20V11.5M9.3 20V8M14.7 20v-5M20 20V4.5"/><path d="M2.5 20.5h19"/>',
    ls: '<path d="M7 20.5V7.5"/><path d="M3.9 10.6 7 7.5l3.1 3.1"/><path d="M17 3.5v13"/><path d="M13.9 13.4 17 16.5l3.1-3.1"/>',
    fng: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.2-4.2"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>',
    mkt: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    defi: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
    cycle: '<circle cx="12" cy="12" r="9"/><path d="M6 14.6c2-6 4-6 6 0s4 6 6-3"/>',
    /* calculators + tools */
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="18" x2="16" y2="18"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01"/>',
    journal: '<path d="M6 3.5h11.5A1.5 1.5 0 0 1 19 5v14.5a1.5 1.5 0 0 1-1.5 1.5H6"/><path d="M6 3.5A2 2 0 0 0 4 5.5v13A2 2 0 0 0 6 20.5"/><path d="M9 8.5h6"/><path d="M9 12.6l1.6 1.6L14 10.8"/>',
    backtest: '<circle cx="12" cy="13.2" r="7.6"/><path d="M12 9.6v3.6l2.5 1.6"/><path d="M4.6 5.6 6.9 3.4"/><path d="M19.4 5.6 17.1 3.4"/>',
    pivot: '<path d="M3.4 13.6h17.2"/><path d="M12 13.6 9 20.4h6L12 13.6z"/><path d="M6 10.4h4.2M13.8 7.4H18"/>',
    ruin: '<path d="M3.4 20.6h17.2"/><path d="M5 4.4v12.2M9.7 7.8v8.8M14.4 12.2v4.4M19.1 15.4v1.2"/><path d="M3.4 16.9h17.2" stroke-dasharray="2 2.6"/>',
    corr: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2"/><path d="M12 3.4v17.2M3.4 12h17.2"/><circle cx="7.6" cy="8.1" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.3" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16.2" r="1.1" fill="currentColor" stroke="none"/>',
    alert: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    embed: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M2.5 8.6h19"/><path d="M8.6 15.6 6.4 13l2.2-2.6"/><path d="M15.4 10.4 17.6 13l-2.2 2.6"/>',
    /* learn */
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.4 8.6l-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1z"/>',
    cap: '<path d="M2.5 9.2 12 4.6l9.5 4.6L12 13.8 2.5 9.2z"/><path d="M6.6 11.3v4.4c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-4.4"/><path d="M21.5 9.4v5.2"/>',
    book: '<path d="M4 5.6A2.1 2.1 0 0 1 6.1 3.5H11v17H6.1A2.1 2.1 0 0 0 4 22.6V5.6z"/><path d="M20 5.6a2.1 2.1 0 0 0-2.1-2.1H13v17h4.9a2.1 2.1 0 0 1 2.1 2.1V5.6z"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    news: '<path d="M4 4h13a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1H5a1 1 0 0 1-1-1z"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><line x1="7" y1="8" x2="14" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="16" x2="11" y2="16"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    /* developers */
    bot: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    docs: '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5z"/><path d="M14 3.5V8h4.5"/><path d="M9.6 13.4 11.1 15l-1.5 1.6"/><path d="M14.4 13.4 12.9 15l1.5 1.6"/>',
    braces: '<path d="M8.6 3.6C6.1 3.6 6.6 9 4.1 12c2.5 3 2 8.4 4.5 8.4"/><path d="M15.4 3.6c2.5 0 2 5.4 4.5 8.4-2.5 3-2 8.4-4.5 8.4"/>',
    status: '<path d="M12 2.8 4.6 5.6v6.2c0 4.5 3.1 7.9 7.4 9.4 4.3-1.5 7.4-4.9 7.4-9.4V5.6L12 2.8z"/><path d="M8 12.2h2l1.4-2.7 1.6 4.3 1.2-1.6H16"/>',
    /* more */
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1V10"/>',
    swap: '<path d="M4 8.6h13"/><path d="M13.4 5 17 8.6 13.4 12.2"/><path d="M20 15.4H7"/><path d="M10.6 11.8 7 15.4l3.6 3.6"/>',
    tg: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    scale: '<path d="M12 4.4v16.2"/><path d="M8.6 20.6h6.8"/><path d="M4 8.6h16"/><path d="M4 8.6 1.9 13.4a2.5 2.5 0 0 0 4.2 0L4 8.6z"/><path d="M20 8.6l-2.1 4.8a2.5 2.5 0 0 0 4.2 0L20 8.6z"/><circle cx="12" cy="5.2" r="1.35"/>'
  };
  var I = {}; for (var _k in PT) { if (Object.prototype.hasOwnProperty.call(PT, _k)) I[_k] = SV(PT[_k]); }
  I.chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#5c656f;flex-shrink:0"><path d="M9 18l6-6-6-6"/></svg>';

  // Every row carries data-kw: the words a reader actually types. The label alone is a dead end - measured
  // 2026-09-15, 26 of 98 realistic queries ("leaderboard", "withdraw", "webhook", "stop loss", "fear greed")
  // matched NOTHING in the menu, because the filter compared the query to the visible text and nothing else.
  function row(tKey, sKey, href, c, ic, kw, badge) {
    return '<a class="mpnav-row' + (badge === 'HOT' ? ' mpnav-hot' : '') + '" href="' + href + '"'
      + (kw ? ' data-kw="' + kw + '"' : '') + '>'
      + '<span class="mpnav-ic" style="color:' + c + ';background:' + c + '22">' + I[ic] + '</span>'
      + '<span class="mpnav-rt"><b>' + TR(tKey) + (badge ? ' <i class="mpnav-hotb">' + badge + '</i>' : '') + '</b><small>' + TR(sKey) + '</small></span>'
      + I.chev + '</a>';
  }
  function xrow(key, t, s, c, ic, kw) { // expandable parent row
    return '<button type="button" class="mpnav-row mpnav-expand" data-mpexpand="' + key + '"' + (kw ? ' data-kw="' + kw + '"' : '') + '>'
      + '<span class="mpnav-ic" style="color:' + c + ';background:' + c + '22">' + I[ic] + '</span>'
      + '<span class="mpnav-rt"><b>' + TR(t) + '</b><small>' + TR(s) + '</small></span>' + I.chev + '</button>';
  }
  function sub(href, label, kw) { return '<a class="mpnav-subrow" href="' + href + '"' + (kw ? ' data-kw="' + kw + '"' : '') + '>' + TR(label) + '</a>'; }
  function mrow(href, ic, label, kw, ext) {
    return '<a class="mpnav-mrow" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + (kw ? ' data-kw="' + kw + '"' : '') + '>' + I[ic] + '<span>' + TR(label) + '</span></a>';
  }

  // ===== THE DRAWER =====
  // EIGHT SHORT SECTIONS BY INTENT (2026-09-15, owner: "ajde malo bolje da organizujemo browse").
  // It was five sections with a 25-row "Trade" dump that held the terminal, the calendar, the community, the
  // news, the API and every market page at the same level. Order follows what the site IS, then measured use:
  // /paper-trade 22.4k pageviews in 30 days, /rewards/ 15.7k, /season/ 2.1k, /screener 1.9k, /academy/ 1.7k.
  var html = '<div class="mpnav-sheet"><div class="mpnav-head"><span class="mpnav-title">' + TR('brBrowse') + '</span><button type="button" class="mpnav-x" aria-label="' + TR('navClose') + '">&#10005;</button></div>'
    + '<div class="mpnav-sw"><input type="text" class="mpnav-search" placeholder="' + TR('brSearch') + '" autocomplete="off" aria-label="Search"></div>'
    + '<div class="mpnav-scroll">'
    + '<div class="mpnav-sugg" id="mpnavSugg" hidden></div>'
    // Where to start sits ABOVE every section (owner 2026-09-17): the one row for a reader who does not yet know
    // which section to open. It belongs to no section, so the search filter and the E2E leave it uncounted.
    + row('brWtsT', 'brWtsS', '/where-to-start/', '#c2f64a', 'compass', 'start where to start beginner new first steps how to begin basics zero', 'START')

    + '<div class="mpnav-sec">' + TR('secTradeP') + '</div>'
    + row('prodPaper', 'brPaperS', '/paper-trade', '#2ebd85', 'plan', 'practice demo futures perpetual perps long short leverage position margin liquidation entry terminal trade paper testnet risk free')
    + row('brSpotT', 'brSpotS', '/spot/', '#c2f64a', 'spot', 'spot wallet memecoin meme coin card buy sell swap solana chain degen demo account portfolio')
    + row('prodCharts', 'prodChartsS', '/charts', '#3fd8e6', 'charts', 'chart charts candlestick candles indicator indicators rsi macd ema moving average drawing timeframe tradingview technical analysis')
    + row('prodScreener', 'brScrS', '/screener', '#6aa3ff', 'scr', 'screener scanner movers gainers losers volume funding open interest scan filter markets stocks shares forex fx indices sp500 nasdaq gold silver metals')
    // "Simulators" (the five SEO landing pages: stock / forex / index / leverage / no-sign-up) was REMOVED on
    // 2026-09-17 - owner: readers asked what the difference from Paper Trade is, and there is none; every one of
    // them opens the same terminal. The pages keep 15-21 static inbound links each (measured), so nothing orphans.

    + '<div class="mpnav-sec">' + TR('secCompete') + '</div>'
    + row('brSeasonT', 'brSeasonS', '/season/', '#c2f64a', 'trophy', 'season pass tiers daily call goals streak boards standings rank prizes')
    + row('Leaderboards', 'Every season board in full, prizes and rules', '/leaderboards/', '#ffd75a', 'ranks', 'leaderboard leaderboards standings ranking rank table tables rules prizes top traders who is winning')
    + row('brCompT', 'brCompS', '/trading-competition/', '#ffd75a', 'podium', 'competition competitions contest tournament prize prizes pool win money free entry leaderboard compete')
    + row('brArenaT', 'brArenaS', '/arena/', '#7cc4ff', 'arena', 'arena bot arena bots bot ranking api bots robot leaderboard win rate')
    + row('brFreeT', 'brFreeS', '/rewards/', '#ffd75a', 'gift', 'rewards faucet claim free usdt money withdraw withdrawal payout cash out missions tasks earn bonus referral refer invite')
    + row('brVaultT', 'brVaultS', '/vault/', '#c792ff', 'vault', 'vault cosmetics frames skins ticks shop store backgrounds ticket themes buy legendary')
    + row('brLevelsT', 'brLevelsS', '/levels/', '#8b5cff', 'starr', 'levels level xp experience bronze silver gold platinum diamond prestige rank ranks progress')
    + row('brPremT', 'brPremS', '/premium/', '#ffd75a', 'crown', 'premium subscription subscribe upgrade plan plans paid founder pro member membership price')

    + '<div class="mpnav-sec">' + TR('secMarkets') + '</div>'
    + row('navRekt', 'prodRektS', '/rekt/', '#ff6258', 'rekt', 'liquidations liquidated rekt feed live wipeout blown up forced closed biggest liquidation today')
    // BROWSE SENDS PEOPLE TO THE LIVE CHART, NOT TO THE SEO PAGE (owner 2026-09-15: "ove stranice mogu da
    // postoje negde u pozadini ali iz browse, mozemo direktno da ih vodimo na heatmap chart"). The 32 per-coin
    // liquidation-map pages stay live and stay indexed - they just are not the door any more. Removing them
    // from here orphans nothing: measured, each carries 34-42 static inbound links (every map page links to
    // every other, plus the /liquidations/ hub), unlike the comparison pages which had 1-3 and had to be kept.
    // The heatmap takes no symbol from the URL, so no row pretends to open a particular coin.
    + row('brHeatT', 'brHeatS', '/heatmap', '#ffb347', 'heat', 'heatmap heat map liquidation map maps levels clusters pools zones magnet btc bitcoin eth ethereum sol solana xrp per coin where price goes')
    + row('brLiqT', 'brLiqS', '/liquidations/', '#ff8c5a', 'map', 'liquidations totals 24h by coin by exchange how much was liquidated today records')
    + row('brWhaleT', 'brWhaleS', '/hyperliquid-whales/', '#5ec6ff', 'whale', 'whale whales big positions large trades hyperliquid smart money tracker wallets millions')
    // Funding, open interest and long/short are three readings of ONE question - what the crowd is holding and
    // what it pays - so they sit as a tight group rather than three full-width rows. They keep their own icon
    // and their own keywords; nothing is hidden, and the section drops from 11 rows to 8.
    + '<div class="mpnav-more">'
    + mrow('/funding/', 'funding', 'brFundT', 'funding funding rate rates perpetual basis carry cost of holding negative positive')
    + mrow('/open-interest/', 'oi', 'brOiT', 'open interest oi positions outstanding contracts leverage in the market')
    + mrow('/long-short/', 'ls', 'brLsT', 'long short ratio positioning longs shorts crowd sentiment accounts bias')
    + mrow('/fear-greed/', 'fng', 'brFngT', 'fear greed fear and greed index sentiment mood emotion fng extreme')
    + '</div>'
    + row('brMktsT', 'brMktsS', '/coins/', '#16c2d6', 'mkt', 'coins markets prices market cap top 100 ranking altcoins list price of bitcoin')
    + row('brDefiT', 'brDefiS', '/defi/', '#9d7bff', 'defi', 'defi tvl total value locked chains protocols stablecoins yield lending dex')
    + row('brCycleT', 'brCycleS', '/bitcoin-cycle/', '#f7a600', 'cycle', 'cycle bitcoin cycle pi cycle rainbow chart halving top signal bull bear market top')

    + '<div class="mpnav-sec">' + TR('secCalc') + '</div>'
    + xrow('calc', 'brCalcT', 'brCalcS', '#c2f64a', 'calc', 'calculator calculators compute work out')
    + '<div class="mpnav-sub" data-sub="calc" hidden>'
    + sub('/calculators?c=liq', 'subLiq', 'liquidation price liq price where will i be liquidated isolated')
    + sub('/calculators?c=cross', 'Cross margin liquidation', 'cross margin liquidation whole balance')
    + sub('/calculators?c=size', 'subSize', 'position size how much to buy risk per trade lot size stake')
    + sub('/calculators?c=pnl', 'subPnl', 'pnl profit loss roi roe return how much did i make')
    + sub('/calculators?c=dca', 'subDca', 'dca average down average entry add to position martingale')
    + sub('/calculators?c=tp', 'subTp', 'take profit target tp exit price where to sell')
    + sub('/calculators?c=rr', 'subRr', 'risk reward ratio rr stop loss target expectancy')
    + sub('/crypto-tax-calculator/', 'Crypto tax calculator', 'tax taxes capital gains hmrc irs report income')
    + sub('/crypto-cost-basis-calculator/', 'Cost basis calculator (FIFO/LIFO)', 'cost basis fifo lifo hifo average cost accounting')
    + sub('/hyperliquid-liquidation-calculator/', 'Hyperliquid liquidation calculator', 'hyperliquid hl liquidation calculator')
    + sub('/bybit-liquidation-calculator/', 'Exchange calculators (Bybit, Binance, OKX, MEXC&hellip;)', 'bybit binance okx mexc bitget kucoin gate exchange calculator per exchange')
    + '</div>'

    + '<div class="mpnav-sec">' + TR('secTools') + '</div>'
    + row('brJrnT', 'brJrnS', '/trading-journal/', '#46e0e6', 'journal', 'journal trading journal log diary notes review export trades record')
    + row('brBtT', 'brBtS', '/crypto-backtester/', '#46e0e6', 'backtest', 'backtest backtester strategy historical test strategy simulate past data')
    + row('brPivT', 'brPivS', '/pivot-point-calculator/', '#6aa3ff', 'pivot', 'pivot pivot points support resistance levels floor trader camarilla fibonacci')
    + row('brRorT', 'brRorS', '/risk-of-ruin-calculator/', '#ff6258', 'ruin', 'risk of ruin bankroll blow up survival probability kelly bust account')
    + row('brCorrT', 'brCorrS', '/crypto-correlation-matrix/', '#c792ff', 'corr', 'correlation matrix correlated diversify pairs move together beta')
    + row('brAlertsT', 'brAlertsS', '/alerts/', '#c2f64a', 'alert', 'alert alerts alarm notify notification price alert telegram email ping when price')
    + row('brCalT', 'brCalS', '/calendar/', '#ffd75a', 'cal', 'calendar events dates fomc cpi fed nfp unlocks economic schedule countdown')

    + '<div class="mpnav-sec">' + TR('secLearn') + '</div>'
    + row('brAcadT', 'brAcadS', '/academy/', '#c2f64a', 'cap', 'academy learn course courses lesson lessons school class study tutorial teach certificate quiz', 'HOT')
    + row('brGuidesT', 'brGuidesS', '/guides/', '#7fd957', 'book', 'guides guide how to explained liquidation explained leverage explained funding explained reference')
    + row('navBlog', 'brBlogS', '/blog/', '#ff8c5a', 'pencil', 'blog articles posts read writing stories')
    + row('brNewsT', 'brNewsS', '/news/', '#ff8c5a', 'news', 'news headlines latest today breaking')
    + row('brCommT', 'brCommS', '/community/', '#c2f64a', 'users', 'community forum posts discussion ideas talk people social feed')

    // Bot API keeps a full row - it is a product with a price. The other three are a reference, a JSON endpoint
    // and an uptime page: the label IS the description, so they take the compact two-column chip instead of
    // 63px each. Same for the More list. That is where the scroll budget above comes from.
    + '<div class="mpnav-sec">' + TR('secDev') + '</div>'
    + row('brApiT', 'brApiS', '/trading-api/', '#3fd8e6', 'bot', 'api bot rest trading api key api key webhook webhooks mcp sdk python javascript node plans rate limit developer automate algo')
    + '<div class="mpnav-more">'
    + mrow('/api-docs/', 'docs', 'brDocsT', 'docs documentation openapi swagger endpoints reference schema spec')
    + mrow('/free-crypto-api/', 'braces', 'brFapiT', 'free api json no key public api price api market data endpoint')
    + mrow('/status/', 'status', 'brStatT', 'status uptime incidents health down outage is it working')
    + mrow('/widgets/', 'embed', 'navWidgets', 'widget widgets embed iframe website blog put on my site')
    + '</div>'

    + '<div class="mpnav-sec">' + TR('secMore') + '</div>'
    + row('brExT', 'brExS', '/exchanges/', '#c2f64a', 'swap', 'exchanges exchange compare comparison fees fee bybit binance okx mexc bitget hyperliquid moon leverage bonus referral sign up best exchange')
    + '<div class="mpnav-more">'
    + mrow('/', 'home', 'mnHome', 'home homepage main')
    + mrow('https://t.me/MarginPadBot', 'tg', 'Telegram', 'telegram tg bot channel group signals wrap', 1)
    + mrow('/about/', 'info', 'navAbout', 'about who we are team story')
    + mrow('/contact/', 'mail', 'navContact', 'contact support help email us problem bug')
    + '</div>'
    // The four comparison/alternative pages live behind a collapsed row (owner 2026-09-15: drop them from the
    // menu, but only if it costs nothing in SEO). It does not: they carry 1-3 static inbound links each, so
    // this sitewide drawer link is the real one - the <a> tags are unchanged, only the wrapper is hidden.
    + xrow('cmp', 'brCmpT', 'brCmpS', '#7f8893', 'scale', 'alternative alternatives compare comparison best vs versus coinglass')
    + '<div class="mpnav-sub" data-sub="cmp" hidden>'
    + sub('/coinglass-alternative/', 'Coinglass alternative', 'coinglass alternative free replacement')
    + sub('/best-crypto-paper-trading-platforms/', 'Best crypto paper trading platforms', 'best paper trading platforms compared')
    + sub('/best-liquidation-heatmap-tools/', 'Best liquidation heatmap tools', 'best heatmap tools compared')
    + sub('/crypto-liquidations-today/', 'Crypto liquidations today', 'liquidations today total 24h record')
    + '</div>'
    + '</div></div>';

  var btn = document.createElement('button'); btn.className = 'mpnav-burger'; btn.setAttribute('aria-label', TR('navMenu')); btn.innerHTML = '<span></span><span></span><span></span>';
  var panel = document.createElement('div'); panel.className = 'mpnav'; panel.hidden = true; panel.innerHTML = html;
  // homepage-style bottom mobile nav bar (Browse / Home / Practice / Trades / Chat) - same look as the homepage on every standalone page
  function bottomBar() {
    var S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var items = [
      ['browse', 'Browse', 'mnBrowse', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
      ['/paper-trade', 'Practice', 'mnPaper', '<path d="M7 3.5v3M7 17.5v3M17 3.5v3M17 13.5v3"/><rect x="4.5" y="6.5" width="5" height="11" rx="1"/><rect x="14.5" y="6.5" width="5" height="7" rx="1"/>'], // candlestick icon + the label reads "Paper Trade" via i18n mnPaper (owner 2026-08-15; internal key stays 'Practice' for the analytics map below)
      ['/paper-trade?trades=1', 'Trades', 'mnTrades', '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'],
      ['/', 'Chat', 'mnChat', '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"/>']
    ];
    var path = location.pathname.replace(/\/$/, '') || '/';
    var keys = { Browse: 'browse', Practice: 'practice', Trades: 'trades', Chat: 'chat' };
    var bn = document.createElement('nav'); bn.className = 'mpbn'; bn.setAttribute('aria-label', 'Quick navigation');
    bn.innerHTML = items.map(function (it) {
      var browse = it[0] === 'browse';
      // match the FULL href (path + query) - else "/paper-trade" and "/paper-trade?trades=1" both lit up on /paper-trade (Trades glowed wrongly)
      var iq = it[0].indexOf('?') >= 0 ? it[0].slice(it[0].indexOf('?')) : '';
      var cur = (!browse && (it[0].split('?')[0].replace(/\/$/, '') || '/') === path && iq === (location.search || '')) ? ' cur' : '';
      return '<a href="' + (browse ? '#' : it[0]) + '" data-mpbn="' + keys[it[1]] + '"' + (browse ? ' role="button"' : '') + ' class="mpbn-i' + cur + '" aria-label="' + TR(it[2]) + '"><svg viewBox="0 0 24 24" width="22" height="22" ' + S + '>' + it[3] + '</svg><span class="mpbn-l">' + TR(it[2]) + '</span></a>';
    }).join('');
    return bn;
  }
  // ===== give every standalone page the SAME desktop header as the homepage =====
  function canonHeaderHTML() {
    // Language list = the 13 homepages that actually exist (/es/ … /ar/; it/pl/hi/vi were 404s until 2026-09-03). A page that
    // translates ITSELF at runtime (Demo Spot) publishes window.__mpLangs (its codes, may include sr) + window.__mpSetLang(code)
    // and the globe switches the page in place instead of navigating to a language homepage.
    var opts = (window.__mpLangs || ['en', 'es', 'de', 'fr', 'pt', 'nl', 'tr', 'ru', 'id', 'zh', 'ja', 'ko', 'ar']).map(function (c) { return [c === 'en' ? '/' : '/' + c + '/', c.toUpperCase()]; });
    var cur = window.__mpLangCur || _NL;
    var lo = opts.map(function (o) { var code = o[0] === '/' ? 'en' : o[0].replace(/\//g, ''); return '<option value="' + o[0] + '"' + (code === cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    return '<div class="brand"><button type="button" class="hmenu" id="mBurger" aria-label="' + TR('navMenu') + '"><span></span><span></span><span></span></button>'
      + '<a href="/" class="mark" aria-label="MarginPad - home">MARGIN<b>PAD</b></a></div>'
      + '<nav class="hnav">'
      + '<a href="https://t.me/MarginPadBot" target="_blank" rel="noopener" class="hlink hbot"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Bot</a>'
      + '<a href="https://t.me/marginpad" target="_blank" rel="noopener" class="hlink htg" title="Join our Telegram group" aria-label="Telegram group"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg></a>'
      + '<a href="/paper-trade?trades=1" class="hlink hjr"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>My Trades</a>'
      + '<button type="button" class="hlink hauth" data-auth-open aria-label="Sign in"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span data-auth-status>Sign in</span></button>'
      + '<select class="lang" id="langSel" aria-label="Language">' + lo + '</select></nav>';
  }
  /* ONE language switch for every page (owner 2026-09-13: "kad izaberem španski, uvek treba da bude selektovan taj jezik
     na svakoj stranici" - on /es/ and /rewards/ the dropdown still said EN because five different copies of the <select>
     (bento home, rewards, rekt, app shell, this canonical header) each had their own idea of the current language).
     Rules: the current language = URL prefix > ?lang > localStorage mp_lang (_mpLang). Every #langSel on the page is set
     to it on load (option values are '/es/' on hand-made headers and 'es' on the app shell - both understood) and its
     inline onchange is replaced by wireLangSel: the choice is written to mp_lang FIRST, then en <-> es keep the page
     (/x/ <-> /es/x/, the worker 302s back when a twin is missing), other languages go to their homepage as before, and a
     page that translates itself (Demo Spot, the app shell's i18n loader) still gets __mpSetLang / its own listener.
     esRedirect: a reader who chose Spanish and lands on an English URL is sent to the twin once per path per session
     (sessionStorage mp_es_miss stops the bounce when the worker answers 302 because no twin exists). */
  var _LANG_HOME = { pt: 1, de: 1, fr: 1, ru: 1, tr: 1, zh: 1, ja: 1, ko: 1, ar: 1, id: 1, nl: 1 };
  function langCode(v) { v = String(v || ''); if (!v || v === '/') return v === '/' ? 'en' : ''; var m = v.match(/^\/([a-z]{2})\/?$/); return m ? m[1] : (/^[a-z]{2}$/.test(v) ? v : ''); }
  function syncLangSel() {
    try {
      var cur = window.__mpLangCur || _mpLang(), sels = document.querySelectorAll('#langSel, select.lang[aria-label="Language"]');
      for (var i = 0; i < sels.length; i++) { var s = sels[i], hit = -1; for (var k = 0; k < s.options.length; k++) { if (langCode(s.options[k].value) === cur) { hit = k; break; } } if (hit >= 0 && s.selectedIndex !== hit) s.selectedIndex = hit; if (!s.__mpLangWired) wireLangSel(s); }
    } catch (e) {}
  }
  function wireLangSel(ls) {
    if (!ls || ls.__mpLangWired) return; ls.__mpLangWired = 1;
    try { ls.removeAttribute('onchange'); ls.onchange = null; } catch (e) {}
    ls.addEventListener('change', function () {
      if (!ls.value) return;
      var _code = langCode(ls.value); if (!_code) { location.href = ls.value; return; }
      try { var _ln = (ls.options[ls.selectedIndex] || {}).textContent || ls.value; window.__mpTrack && window.__mpTrack('lang', _ln); } catch (e) {}
      try { localStorage.setItem('mp_lang', _code); } catch (e) {}
      try { sessionStorage.removeItem('mp_es_miss'); } catch (e) {}
      if (window.__mpSetLang && window.__mpSetLang(_code) === true) return; // self-translating page (Demo Spot)
      var _p = location.pathname, _onEs = _p.indexOf('/es/') === 0 || _p === '/es';
      if (_code === 'en') { location.href = _onEs ? (_p.slice(3) || '/') + location.search : (_LANG_HOME[(_p.match(/^\/([a-z]{2})\//) || [])[1]] ? '/' : (_p + location.search)); return; }
      if (_code === 'es') { if (_onEs) return; location.href = (/^\/([a-z]{2})\/$/.test(_p) ? '/es/' : '/es' + _p) + location.search; return; }
      if (window.mpT && document.getElementById('langSel') === ls) return; // app shell: i18n.js applies the pack in place
      location.href = '/' + _code + '/';
    });
  }
  function esRedirect() {
    try {
      if (window.__mpEsRedir) return; window.__mpEsRedir = 1;
      var L = localStorage.getItem('mp_lang'), p = location.pathname;
      if (L !== 'es' || /^\/es(\/|$)/.test(p) || /^\/(api|assets|mcp|widget|community)\//.test(p) || /^\/(pt|de|fr|ru|tr|zh|ja|ko|ar|id|nl)\//.test(p)) return;
      if (/^\/(dolar-cripto|bitcoin-hoje|simulador-trading-cripto-argentina|simulador-trading-cripto-brasil)\//.test(p)) return;
      if (new URLSearchParams(location.search).get('lang')) return;
      var miss = (sessionStorage.getItem('mp_es_miss') || '').split('|');
      if (miss.indexOf(p) >= 0) return;
      miss.push(p); sessionStorage.setItem('mp_es_miss', miss.filter(Boolean).join('|'));
      location.replace('/es' + (p === '/' ? '/' : p) + location.search + location.hash);
    } catch (e) {}
  }
  esRedirect();
  function normalizeHeader() {
    try {
      syncLangSel();
      if (document.querySelector('header .hbot')) return; // already the canonical header (homepage / app-shell / defi / rekt / rewards) - .hbot is the stable sentinel (Rewards link was removed from headers)
      var h = document.querySelector('body>header') || document.querySelector('body>.wrap>header');
      if (!h) return;
      // only a simple site header (brand + a few nav links) is safe to rebuild - never one carrying a widget
      if (h.querySelector('input,form,canvas,table,.tabs,[role="tablist"]')) return;
      h.classList.add('mpnav-hdr');
      h.innerHTML = canonHeaderHTML();   // burger click is bound by wireBurgers() below (mp-auth handles [data-auth-open] by delegation)
      var ls = h.querySelector('#langSel'); if (ls) wireLangSel(ls);
    } catch (e) {}
  }
  // EVERY header burger opens THE shared drawer. Pages' own scripts may also route here (defi, demo-home,
  // lang homepages) - the open() re-entry guard makes double wiring harmless. Fixes the app shell
  // (/paper-trade /charts /screener /calculators), whose inline browse IIFE is gated on the removed .mobnav
  // and so never binds its #hmenuBtn anymore.
  function wireBurgers() {
    try {
      Array.prototype.forEach.call(document.querySelectorAll('header .hmenu, header #mBurger'), function (b) {
        if (b.__mpNavWired) return; b.__mpNavWired = 1;
        b.addEventListener('click', function (e) { e.preventDefault(); open(); });
      });
    } catch (e) {}
  }
  // Pin the header to the very top: on pages whose <header> sits inside a padded .wrap, the sticky header
  // starts 16–22px down and page content peeks above it. Measure the actual offset and pull it up.
  function pinHeader() { try {
    if ((window.scrollY || window.pageYOffset || 0) > 2) return;   // only meaningful at the top of the page
    var hh = document.querySelector('body>.wrap>header, body>header'); if (!hh) return;
    hh.style.marginTop = '';
    var t = hh.getBoundingClientRect().top;
    if (t > 0 && t < 120) hh.style.marginTop = (-t) + 'px';
    // mobile: full-bleed horizontally - headers inside a padded .wrap render 16-24px narrower than the
    // screen and read as "cut off" at the left/right edges (alerts/fear-greed/news/coins/blog/...)
    if (window.innerWidth <= 720) {
      hh.style.marginLeft = ''; hh.style.marginRight = ''; hh.style.paddingLeft = ''; hh.style.paddingRight = '';
      var r = hh.getBoundingClientRect();
      if (r.left > 0.5) {
        var cs = getComputedStyle(hh);
        hh.style.paddingLeft = (parseFloat(cs.paddingLeft) + r.left) + 'px';
        hh.style.paddingRight = (parseFloat(cs.paddingRight) + (window.innerWidth - r.right)) + 'px';
        hh.style.marginLeft = (-r.left) + 'px';
        hh.style.marginRight = (r.right - window.innerWidth) + 'px';
      }
    }
  } catch (e) {} }
  // Every page's header gets the blue Telegram-group plane after the Bot link. Canonical/injected headers already
  // carry it inline; this covers standalone pages that keep their OWN inline header (defi, blog, coin, tools…).
  function ensureTelegram() {
    try {
      if (document.querySelector('header .htg')) return;
      var bot = document.querySelector('header .hbot'); if (!bot || !bot.parentNode) return;
      var a = document.createElement('a');
      a.href = 'https://t.me/marginpad'; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'hlink htg'; a.title = 'Join our Telegram group'; a.setAttribute('aria-label', 'Telegram group');
      a.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>';
      bot.parentNode.insertBefore(a, bot.nextSibling);
    } catch (e) {}
  }
  function mount() { if (!document.body) return;
    normalizeHeader();
    ensureTelegram();
    pinHeader();
    window.addEventListener('resize', function () { clearTimeout(window.__mpHdrT); window.__mpHdrT = setTimeout(pinHeader, 150); });
    // Pages that already have their OWN header burger (homepage / lang homepages / defi / app-shell = .hmenu/#mBurger)
    // must not SHOW a 2nd one - but their burger opens this drawer by .click()-ing mp-nav's burger, so we still append it
    // as an INVISIBLE click target (display:none), plus window.mpNavOpen. Removing it entirely broke those pages' openBrowse.
    var hasOwnBurger = document.querySelector('.hmenu, #mBurger');
    if (hasOwnBurger) btn.style.display = 'none';
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    // THE one mobile bar - mp-nav owns it SITE-WIDE. Any legacy inline bar (.mobnav variants on the old
    // homepage/app-shell/rekt/rewards, .smobnav on hub pages) is removed so every page shows the SAME four
    // items in the same order. Navigation is habit - it must never differ between pages (owner rule).
    try { Array.prototype.forEach.call(document.querySelectorAll('.smobnav,.mobnav'), function (n) { n.remove(); }); } catch (e) {}
    try { document.body.appendChild(bottomBar()); } catch (e) {} wire(); wireBurgers(); }
  var searchEl, scrollEl, _navY = 0;
  // NORMALISE, THEN TOKENISE. The old filter compared the raw query to the row's visible textContent as one
  // substring, so "fear greed" missed the row that reads "Fear & Greed", "risk reward" missed "Risk / reward"
  // and "liq price" missed "Liquidation price" - measured 2026-09-15: 26 of 98 realistic queries found nothing
  // anywhere. Now '&' becomes ' and ', every other separator becomes a space, and EVERY token must appear
  // somewhere in the label + subtitle + data-kw + the href.
  function nrm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/&amp;/g, '&').replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function toks(q) { var n = nrm(q); return n ? n.split(' ') : []; }
  function hay(it) {
    if (it.__mpHay) return it.__mpHay;
    var h = nrm((it.textContent || '') + ' ' + (it.getAttribute('data-kw') || '') + ' ' + (it.getAttribute('href') || ''));
    it.__mpHay = h; return h;
  }
  function hits(it, tk) { if (!tk.length) return true; var h = hay(it); for (var i = 0; i < tk.length; i++) { if (h.indexOf(tk[i]) < 0) return false; } return true; }
  function filter(q) {
    q = (q || '').trim(); if (!scrollEl) return;
    var tk = toks(q);
    // searching reveals EVERY collapsed group (simulators, liquidation maps, calculators, comparisons) so a
    // sub-item can match - it used to reveal only the first .mpnav-sub, i.e. the calculators
    Array.prototype.forEach.call(scrollEl.querySelectorAll('.mpnav-sub'), function (s) { s.hidden = !tk.length; });
    var curSec = null, secHas = false;
    function flush() { if (curSec) curSec.style.display = secHas ? '' : 'none'; }
    Array.prototype.forEach.call(scrollEl.children, function (el) {
      if (el.className === 'mpnav-sec') { flush(); curSec = el; secHas = false; return; }
      var items = el.matches('.mpnav-row,.mpnav-mrow,.mpnav-subrow') ? [el] : Array.prototype.slice.call(el.querySelectorAll('.mpnav-row,.mpnav-mrow,.mpnav-subrow'));
      if (!items.length) return;
      var anyVis = false;
      items.forEach(function (it) { var m = hits(it, tk); it.style.display = m ? '' : 'none'; if (m) anyVis = true; });
      el.style.display = anyVis ? '' : 'none'; if (anyVis) secHas = true;
    });
    flush();
    renderSugg(q);
    var sg = document.getElementById('mpnavSugg'); var hasSugg = sg && !sg.hidden && sg.children.length;
    var nr = scrollEl.querySelector('.mpnav-nores');
    var any = Array.prototype.some.call(scrollEl.querySelectorAll('.mpnav-row,.mpnav-mrow,.mpnav-subrow'), function (it) { return it.style.display !== 'none'; });
    if (!any && !hasSugg && q) { if (!nr) { nr = document.createElement('div'); nr.className = 'mpnav-nores'; scrollEl.appendChild(nr); } nr.textContent = TR('brNoRes') + ' “' + q + '”.'; nr.style.display = ''; }
    else if (nr) nr.style.display = 'none';
  }
  // Browse search → live content suggestions from the whole site (lazy-loads /search-index.json)
  var SIDX = null, _sidxL = false;
  function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function loadSidx(cb) { if (SIDX) { if (cb) cb(); return; } if (_sidxL) return; _sidxL = true; fetch('/search-index.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (a) { SIDX = a || []; _sidxL = false; if (cb) cb(); }).catch(function () { SIDX = []; _sidxL = false; }); }
  // RANKED, not "the first eight in file order". The index is sorted by URL LENGTH (gen-search-index.js), so the
  // old loop returned whatever short path happened to contain the string - typing "bitcoin" answered with the
  // shortest URLs, never the best page. Score: every token must appear; the title outranks the URL, a whole-word
  // hit outranks a fragment, a title that STARTS with the query wins, an exact title wins outright.
  var _SKIP_U = { '/api/': 1 };  // retired 2026-09-15 (301 -> /trading-api/) - never suggest a redirect
  function _prep(x) { if (x.__n == null) { x.__n = nrm(x.t); x.__nu = nrm(x.u); } return x; }
  function score(x, tk, qn) {
    _prep(x); var t = x.__n, u = x.__nu, s = 0;
    for (var i = 0; i < tk.length; i++) {
      var k = tk[i], inT = t.indexOf(k), inU = u.indexOf(k);
      if (inT < 0 && inU < 0) return -1;                                  // every token must be somewhere
      if (inT >= 0) { s += 20; if (t.indexOf(' ' + k) >= 0 || inT === 0) s += 10; }  // word boundary in the title
      else { s += 8; }
    }
    if (t === qn) s += 90;
    else if (t.indexOf(qn) === 0) s += 45;
    else if (t.indexOf(' ' + qn) >= 0) s += 20;
    s -= Math.min(12, Math.floor(x.u.length / 8));                        // a shorter path is the tie-break, not the ranking
    return s;
  }
  function renderSugg(q) { var box = document.getElementById('mpnavSugg'); if (!box) return;
    var tk = toks(q), qn = nrm(q);
    if (qn.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    if (!SIDX) { loadSidx(function () { renderSugg(q); }); return; }
    var scored = [];
    for (var i = 0; i < SIDX.length; i++) { var x = SIDX[i]; if (_SKIP_U[x.u]) continue; var s = score(x, tk, qn); if (s >= 0) scored.push([s, x]); }
    scored.sort(function (a, b) { return b[0] - a[0]; });
    var hits = scored.slice(0, 8).map(function (p) { return p[1]; });
    if (!hits.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = '<div class="mpnav-sec">'+TR('brPages')+'</div>' + hits.map(function (h) { return '<a class="mpnav-sg" href="' + h.u + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span>' + _esc(h.t) + '</span><small>' + _esc(h.u) + '</small></a>'; }).join('');
    box.hidden = false; }
  function open() { if (!panel.hidden) return; /* re-entry guard: several pages route their burger here AND get the global wiring - never double-open */ if (searchEl) { searchEl.value = ''; filter(''); } loadSidx(); panel.hidden = false; _navY = window.scrollY || window.pageYOffset || 0; document.documentElement.style.overflow = 'hidden'; document.body.style.position = 'fixed'; document.body.style.top = (-_navY) + 'px'; document.body.style.left = '0'; document.body.style.right = '0'; document.body.style.width = '100%'; requestAnimationFrame(function () { panel.classList.add('open'); if (searchEl && !touchOnly()) setTimeout(function () { searchEl.focus(); }, 250); }); } // desktop only: on a phone the auto-focus popped the keyboard every time the menu opened (ibrar + AEB, chat 2026-09-04)
  function touchOnly() { try { return window.matchMedia && window.matchMedia('(hover:none) and (pointer:coarse)').matches; } catch (e) { return false; } }
  function close() { panel.classList.remove('open'); document.documentElement.style.overflow = ''; document.body.style.position = ''; document.body.style.top = ''; document.body.style.left = ''; document.body.style.right = ''; document.body.style.width = ''; if (_navY) window.scrollTo(0, _navY); setTimeout(function () { panel.hidden = true; }, 300); }
  try { window.mpNavOpen = open; } catch (e) {}  // let other pages (e.g. Rekt's own nav) open this full, single-source-of-truth Browse drawer
  function wire() {
    searchEl = panel.querySelector('.mpnav-search'); scrollEl = panel.querySelector('.mpnav-scroll');
    btn.addEventListener('click', open);
    // the canonical bar prefers the LIVE in-page feature when the page has it, and falls back to navigation:
    // Browse → the shared drawer (same everywhere) · Practice → in-page Paper-Trade switch on the app shell ·
    // Chat everywhere (2026-09-06, owner: "chat must be available on every page it is opened on, not bounce you to
    // the homepage"). The widget used to exist only where mp-trade.js ships (homepage, app shell, rekt, rewards);
    // on every other page the bottom-bar Chat was a link to '/' that landed with the chat CLOSED. Now a page without
    // the widget gets the same markup those pages carry (FAB + box) at load, its stylesheet, and mp-trade.js only on
    // the first click - the bundle bails on everything else it looks for (journal drawer) when the markup is absent.
    var CHAT_HTML = '<button id="chatFab" type="button" aria-label="Open trader chat"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:-2px"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"/></svg><span>Chat</span></button>'
      + '<div id="chatBox" hidden><div class="ct-head"><span class="ct-title">Trader Chat</span><span class="ct-online" id="ctOnline"></span><button class="ct-x" id="ctClose" type="button" aria-label="Close">\u2715</button></div>'
      + '<div class="ct-gate" id="ctGate"><p>Sign in to join the chat \u2014 it\u2019s free (just an email code). Please don\u2019t post your email in the chat.</p><button id="ctSignin" type="button">Sign in to chat</button></div>'
      + '<div class="ct-msgs" id="ctMsgs" hidden></div><form class="ct-form" id="ctForm" hidden><input id="ctInput" maxlength="280" placeholder="Type a message\u2026" autocomplete="off"><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></form></div>';
    var CHAT_JS = '/assets/mp-trade.js?v=5e8cd494', CHAT_CSS = '/assets/mp-trade.css?v=06633675', chatLoading = null;
    function chatWanted() { var pth = location.pathname; return !/^\/(spot|api)(\/|$)/.test(pth) && !document.getElementById('chatFab') && !document.getElementById('ctMsgs'); }
    function chatCss() { if (document.querySelector('link[href*="/assets/mp-trade.css?v=06633675"]')) return; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CHAT_CSS; document.head.appendChild(l); }
    function chatMarkup() { if (document.getElementById('chatFab')) return; var w = document.createElement('div'); w.id = 'mpChatHost'; w.innerHTML = CHAT_HTML; document.body.appendChild(w); }
    // the FAB is on the page from load (it is how a desktop visitor finds the chat); the bundle waits for the first click
    function ensureChat(cb) {
      // A page that ships home.js (the app shell) owns its chat: NEVER pull mp-trade.js on top of it. Doing so gave /paper-trade a second
      // chat and a second add() on the Open button (every open after a Chat tap doubled - 2026-09-12). The callback clicks #chatFab, which home.js handles.
      if (window.mpOpenChat || document.querySelector('script[src*="/assets/home.js"]')) { cb(); return; }
      chatCss(); chatMarkup();
      if (!chatLoading) { chatLoading = new Promise(function (res) { var sc = document.createElement('script'); sc.src = CHAT_JS; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); }); }
      // identity first: chat asks who you are the moment it opens, and on a page without mp-auth that answer was
      // always "nobody" - the member got the sign-in gate with their own session in the cookie jar.
      chatLoading.then(function () { ensureAuth(function () { setTimeout(cb, 30); }); });
    }
    window.mpEnsureChat = ensureChat;
    // Clicking a name in chat opens that trader's card - but the card lives in mp-profile.js, which only 3 of the ~400
    // pages that carry the nav actually load (2026-09-13, owner: "kliknem na bilo čiji username i ništa se ne dešava,
    // to ne sme ni na jednoj stranici"). Chat is injected everywhere, so the card has to follow it: pull the bundle on
    // the first click, exactly like chat pulls mp-trade.js. The bento homepage has its own inline card (lbOpenProfile)
    // and must never get a second one, which is why that is checked first.
    // A SIGNED-IN MEMBER MUST BE RECOGNISED ON EVERY PAGE (2026-09-13). 755 of the 848 pages that carry this nav never
    // loaded mp-auth.js, so on them a member was treated as a guest: chat opened its sign-in gate instead of the room,
    // there was no account menu, no toasts, no partner ordering. Measured on /10x-liquidation-calculator/: mpAuth.me()
    // false and no mp-auth-change ever fired, while /vault/ (which ships the bundle) resolved the session fine.
    // It is pulled LAZILY, never eagerly on an SEO page for a guest: the mp_li cookie (set at sign-in, readable from
    // JS, already used to paint the member card before first frame) says this browser has a session, and any feature
    // that needs identity asks for it through ensureAuth. mp-auth self-guards on window.mpAuth, so a page that already
    // ships it is untouched.
    var AUTH_JS = '/assets/mp-auth.js?v=9e684271', authLoading = null;
    function hasAuthTag() { try { return !!document.querySelector('script[src*="/assets/mp-auth.js?v=9e684271"]'); } catch (e) { return false; } }
    function liCookie() { try { return /(?:^|;\s*)mp_li=1/.test(document.cookie); } catch (e) { return false; } }
    function ensureAuth(cb) {
      if (window.mpAuth || hasAuthTag()) { if (cb) cb(); return; }
      if (!authLoading) { authLoading = new Promise(function (res) { var sc = document.createElement('script'); sc.src = AUTH_JS; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); }); }
      authLoading.then(function () { if (cb) setTimeout(cb, 20); });
    }
    window.mpEnsureAuth = ensureAuth;
    // a browser that holds a session gets it resolved on every page, after load so it never competes with first paint
    if (liCookie() && !window.mpAuth && !hasAuthTag()) {
      if (document.readyState === 'complete') setTimeout(function () { ensureAuth(); }, 400);
      else window.addEventListener('load', function () { setTimeout(function () { ensureAuth(); }, 400); });
    }
    var PROF_JS = '/assets/mp-profile.js?v=4e4826a7', profLoading = null;
    window.mpEnsureProfile = function (cb) {
      if (window.mpOpenProfile || window.lbOpenProfile) { cb(); return; }
      if (!profLoading) { profLoading = new Promise(function (res) { var sc = document.createElement('script'); sc.src = PROF_JS; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); }); }
      profLoading.then(function () { setTimeout(cb, 20); });
    };
    if (chatWanted()) { try { chatCss(); chatMarkup(); document.addEventListener('click', function (e) { var f = e.target.closest && e.target.closest('#chatFab'); if (!f || window.mpOpenChat) return; e.preventDefault(); e.stopImmediatePropagation(); ensureChat(function () { if (window.mpOpenChat) window.mpOpenChat(); else { var f2 = document.getElementById('chatFab'); if (f2) f2.click(); } }); }, true); } catch (e) {} }
    // Trades → the live My-Trades drawer (mp-trade.js / home.js) · Chat → the page's chat widget.
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-mpbn]'); if (!b) return;
      var k = b.getAttribute('data-mpbn');
      if (k === 'browse') { e.preventDefault(); open(); return; }
      if (k === 'practice') {
        var pp = document.querySelector('.prod[data-prod="plan"]'); if (pp) { e.preventDefault(); pp.click(); window.scrollTo(0, 0); return; }
        if ((location.pathname.replace(/\/$/, '') || '/') === '/paper-trade') e.preventDefault(); return;
      }
      if (k === 'trades') { if (window.mpOpenTrades) { e.preventDefault(); window.mpOpenTrades(); } return; }
      if (k === 'chat') { e.preventDefault(); ensureChat(function () { if (window.mpOpenChat) window.mpOpenChat(); else { var f = document.getElementById('chatFab'); if (f) f.click(); } }); return; }
    });
    // BROWSE HAS NEVER BEEN MEASURED (2026-09-15). 52 rows and not one beacon, so which of them anybody uses was
    // a matter of opinion. Two events, both types the worker already whitelists and mp-ops already renders
    // ('nav …' and 'searched …'): one per row CLICK, one per SETTLED query. The query one is the valuable half -
    // it says what readers look for and do not find. Never per keystroke, and never the same query twice.
    var _bq = null, _bqSent = {};
    function bcn(t, e) { try { navigator.sendBeacon('/api/track?t=' + t + '&e=' + encodeURIComponent(String(e).slice(0, 48)) + '&p=' + encodeURIComponent(location.pathname)); } catch (x) {} }
    if (searchEl) searchEl.addEventListener('input', function () {
      filter(searchEl.value);
      clearTimeout(_bq); var v = nrm(searchEl.value);
      if (v.length < 2) return;
      _bq = setTimeout(function () { if (_bqSent[v]) return; _bqSent[v] = 1; bcn('search', v); }, 1200); // settled, not mid-typing
    });
    // expandable rows (simulators, liquidation maps, calculators, comparisons): toggle the sub-links
    // (a button, not a link → does not close the drawer)
    panel.addEventListener('click', function (e) { var ex = e.target.closest && e.target.closest('[data-mpexpand]'); if (!ex) return; e.preventDefault(); var key = ex.getAttribute('data-mpexpand'); var sub = panel.querySelector('[data-sub="' + key + '"]'); if (sub) { sub.hidden = !sub.hidden; ex.classList.toggle('open', !sub.hidden); } });
    // A TOOL ROUTE SWITCHES IN PAGE WHEN THE SHELL IS ALREADY LOADED. home.js exposes window.mpGo, and its own
    // (now retired) panel used it - this drawer always did a full navigation, so on /paper-trade picking Charts
    // reloaded the whole shell. Falls back to the plain href everywhere else, which is every SEO page.
    var GO = { '/paper-trade': 1, '/charts': 1, '/calculators': 1, '/screener': 1, '/heatmap': 1, '/swap': 1 };
    panel.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      var href = a.getAttribute('href') || '';
      bcn('nav', (a.querySelector('b') ? a.querySelector('b').textContent : a.textContent || '').trim().slice(0, 40) || href);
      if (window.mpGo && GO[href] && location.pathname !== href) { e.preventDefault(); close(); try { window.mpGo(href); return; } catch (x) { location.href = href; } }
    });
    panel.addEventListener('click', function (e) { var t = e.target; if (t === panel || t.closest('.mpnav-x') || t.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  // Instant navigation: prefetch same-origin pages on hover/pointerdown (Chromium) so the click loads near-instantly;
  // the @view-transition above then cross-fades it. Progressive - unsupported browsers just navigate normally.
  try {
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules') && !document.querySelector('script[type="speculationrules"]')) {
      var sr = document.createElement('script'); sr.type = 'speculationrules';
      sr.textContent = '{"prefetch":[{"source":"document","where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/api/*"}}]},"eagerness":"conservative"}]}';
      document.body.appendChild(sr);
    }
  } catch (_) {}
})();
// Site-wide announcement banner (set in the admin Settings tab): red = severe, orange = blocker, green = fix/small bug.
(function () {
  try {
    if (window.__mpAnn) return; // home.js already fetches + renders the announcement on the app shell - this copy is for standalone pages
    fetch('/api/announce').then(function (r) { return r.ok ? r.json() : null; }).then(function (a) {
      if (!a || !a.level || !a.msg) return;
      try { if (sessionStorage.getItem('mp_ann_x') === String(a.ts)) return; } catch (e) {}
      if (document.getElementById('mpAnnounce')) return;
      var C = { severe: ['rgba(176,28,28,.94)', '#fff'], blocker: ['rgba(226,128,20,.95)', '#1a1205'], fix: ['rgba(36,164,96,.95)', '#04140b'] }[a.level] || ['rgba(40,40,46,.95)', '#fff'];
      var d = document.createElement('div'); d.id = 'mpAnnounce';
      d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483600;padding:9px 38px 9px 14px;text-align:center;font:600 13px/1.45 system-ui,-apple-system,sans-serif;background:' + C[0] + ';color:' + C[1] + ';-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 14px rgba(0,0,0,.45)';
      d.textContent = a.msg;
      var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.innerHTML = '&#10005;';
      x.style.cssText = 'position:absolute;right:9px;top:50%;transform:translateY(-50%);background:none;border:none;color:inherit;font-size:14px;cursor:pointer;opacity:.85';
      x.onclick = function () { d.remove(); try { sessionStorage.setItem('mp_ann_x', String(a.ts)); } catch (e) {} };
      d.appendChild(x); (document.body || document.documentElement).appendChild(d);
    }).catch(function () {});
  } catch (e) {}
})();

/* Trading-tools UX (2026-07): tidy the input row + add an (i) explainer to every input (lab pages only). */
(function(){
  var labels=document.querySelectorAll('.toolbar .row label.f');if(!labels.length)return;
  var TIPS={
    coin:"Which coin to analyze - any USDT pair (BTC, ETH, SOL, PEPE...).",
    tf:"Candle timeframe the tool works on. Shorter = more signals but more noise.",
    strat:"The rule set being tested. Entry/exit rules are explained with the results below.",
    cap:"Starting capital for the simulation, in USD.",
    fee:"Exchange taker fee per trade side, in %. Realistic fees matter a lot for frequent strategies.",
    per:"Pivot period: Daily uses yesterday's candle, Weekly uses last week's.",
    method:"Pivot formula. Classic is the standard floor-trader ladder; Fibonacci and Camarilla weight the levels differently.",
    win:"How many recent candles feed the calculation window.",
    wr:"Win rate - the percentage of trades your system wins.",
    rr:"Reward-to-risk - average win vs average loss (2 means wins are twice as big as losses).",
    risk:"How much of the account you risk on each trade, in %.",
    n:"How many trades to simulate in each run."
  };
  var tip=null;
  function hideTip(){if(tip&&tip.parentNode)tip.parentNode.removeChild(tip);tip=null;}
  function showTip(btn){hideTip();tip=document.createElement('div');tip.className='inf-tip';tip.textContent=btn.getAttribute('data-tip')||'';document.body.appendChild(tip);
    var r=btn.getBoundingClientRect(),w=tip.offsetWidth,x=Math.min(Math.max(8,r.left-10),window.innerWidth-w-8),y=r.bottom+8;
    if(y+tip.offsetHeight>window.innerHeight-8)y=r.top-tip.offsetHeight-8;
    tip.style.left=x+'px';tip.style.top=y+'px';}
  labels.forEach(function(lb){
    var ctl=lb.querySelector('input,select');if(!ctl)return;
    ctl.style.width='';
    var t=TIPS[ctl.id];
    var span=document.createElement('span');span.className='fl';
    while(lb.firstChild&&lb.firstChild!==ctl){var node=lb.firstChild;lb.removeChild(node);span.appendChild(node);}
    if(t){var i=document.createElement('button');i.type='button';i.className='inf';i.textContent='i';i.setAttribute('data-tip',t);i.setAttribute('aria-label','What is this?');span.appendChild(i);}
    lb.insertBefore(span,ctl);
  });
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.inf');if(b){e.preventDefault();if(tip){hideTip();}else showTip(b);return;}if(!e.target.closest||!e.target.closest('.inf-tip'))hideTip();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')hideTip();});
  window.addEventListener('scroll',hideTip,true);
  // coin suggestions: type "ET" -> ETH offered (native datalist fed by /api/symbols, ~500 USDT perps)
  var coinIn=document.getElementById('coin');
  if(coinIn&&!document.getElementById('mpSymList')){
    var dl=document.createElement('datalist');dl.id='mpSymList';document.body.appendChild(dl);
    coinIn.setAttribute('list','mpSymList');coinIn.setAttribute('autocapitalize','characters');
    (window.__mpSymJ=window.__mpSymJ||fetch('/api/symbols').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})).then(function(d){
      var syms=(d&&d.symbols)||[];dl.innerHTML=syms.slice(0,400).map(function(s){return '<option value="'+s+'">';}).join('');
    }).catch(function(){});
  }
})();

/* Cookie notice - one-time, dismissible. The site sets cookies (sign-in session, device id for anti-abuse,
   anonymous stats); this makes that visible. localStorage mp_ck_ok = accepted. */
(function(){
  try{if(localStorage.getItem('mp_ck_ok'))return;}catch(e){return;}
  if(document.getElementById('mpCkBar'))return;
  function mount(){
    if(document.getElementById('mpCkBar'))return;
    var b=document.createElement('div');b.id='mpCkBar';
    b.style.cssText='position:relative;z-index:94;margin:0;display:flex;align-items:center;gap:9px;background:rgba(13,16,21,.97);border-bottom:1px solid #2b323b;padding:7px 12px;font-family:Familjen Grotesk,system-ui,sans-serif;font-size:12px;line-height:1.35;color:#aab2bd'; // one slim line (2026-09-07 UX pass): the four-line card sat above the brand on every first visit and covered drawer headers
    b.innerHTML='<span style="flex:0 0 auto;display:inline-flex"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c9a86a" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="#c9a86a" stroke="none"/><circle cx="14.5" cy="9" r="1" fill="#c9a86a" stroke="none"/><circle cx="10.5" cy="14.5" r="1" fill="#c9a86a" stroke="none"/><circle cx="15" cy="14" r="1" fill="#c9a86a" stroke="none"/></svg></span><span style="flex:1;min-width:0">Cookies: sign-in, security and anonymous analytics. No ad tracking.</span><button type="button" id="mpCkOk" style="flex:0 0 auto;background:#c2f64a;border:none;border-radius:9px;color:#0a0b0d;font-family:\'Space Mono\',monospace;font-size:11px;font-weight:800;letter-spacing:.03em;padding:5px 11px;cursor:pointer">OK</button>';
    document.body.insertBefore(b,document.body.firstChild); // in the document flow at the top (2026-09-02): the fixed bottom card covered the primary buttons on phones
    document.getElementById('mpCkOk').addEventListener('click',function(){try{localStorage.setItem('mp_ck_ok',String(Date.now()));}catch(e){}b.remove();});
  }
  if(document.readyState!=='loading')setTimeout(mount,900);else document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,900);});
})();

/* Universal pageview beacon (2026-07-17): mp-nav.js loads on EVERY standalone page, so this closes the
   tracking hole where blog/rekt/tools/funding/... pages never hit /api/track (GA saw them, our stats didn't).
   Skips pages that already send their own pageview (inline snippet containing t=pageview) to avoid doubles. */
(function () {
  try {
    if (window.__mpPv) return;
    var scr = document.querySelectorAll('script:not([src])');
    for (var i = 0; i < scr.length; i++) { if ((scr[i].textContent || '').indexOf('t=pageview') > -1) { window.__mpPv = 1; return; } }
    window.__mpPv = 1;
    // entry source (gclid/utm/fbclid/ref → then referrer host), session-cached - same as the homepage beacon.
    // A cached '' keeps trying (mid-session external return can still name the source); a found source is also
    // persisted as the 90d first-touch (mp_src0) so returning/webview sessions still report origin via &s0.
    var esrc = ''; try { var s = sessionStorage.getItem('mp_src'); if (s) esrc = s; else { var p2 = new URLSearchParams(location.search || ''); if (p2.get('gclid') || p2.get('gbraid') || p2.get('wbraid')) esrc = 'google-ads'; else if (p2.get('msclkid')) esrc = 'bing-ads'; else if (p2.get('utm_source')) esrc = p2.get('utm_source') + (p2.get('utm_medium') ? ' / ' + p2.get('utm_medium') : '') + (function () { var c = p2.get('utm_campaign') || p2.get('utm_content'); return c ? ' / ' + String(c).slice(0, 14) : ''; })(); else if (p2.get('fbclid')) esrc = 'facebook'; else if (p2.get('twclid')) esrc = 'twitter'; else if (p2.get('ttclid')) esrc = 'tiktok'; else if (p2.get('ref')) esrc = 'referral'; if (!esrc && document.referrer) { try { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h && h !== 'marginpad.io') esrc = h; } catch (e2) {} } esrc = (esrc || '').slice(0, 40); try { sessionStorage.setItem('mp_src', esrc); } catch (e3) {} } } catch (e4) {}
    var s0 = ''; try { var raw0 = localStorage.getItem('mp_src0'); if (raw0) { var o0 = JSON.parse(raw0); if (o0 && o0.s && (Date.now() - (+o0.ts || 0)) <= 7776e6) s0 = String(o0.s).slice(0, 40); else try { localStorage.removeItem('mp_src0'); } catch (e5) {} } } catch (e6) {}
    if (esrc && !s0) { try { localStorage.setItem('mp_src0', JSON.stringify({ s: esrc, ts: Date.now() })); } catch (e7) {} }
    var q = '/api/track?t=pageview&p=' + encodeURIComponent(location.pathname) + (document.referrer ? '&r=' + encodeURIComponent(document.referrer) : '') + (esrc ? '&src=' + encodeURIComponent(esrc) : (s0 ? '&s0=' + encodeURIComponent(s0) : ''));
    if (navigator.sendBeacon) { navigator.sendBeacon(q); } else { (new Image()).src = q; }
  } catch (e) {}
})();

/* Presence heartbeat (2026-07-17): svakih 60s dok je tab vidljiv -> t=hb, da "online now" na ops-u
   broji i ljude koji drze stranicu otvorenu bez navigacije. Ne broji se kao pageview ni event. */
(function () {
  try {
    if (window.__mpHb) return; window.__mpHb = 1;
    function hb() { try { if (document.hidden) return; var u = '/api/track?t=hb&p=' + encodeURIComponent(location.pathname); if (navigator.sendBeacon) { navigator.sendBeacon(u); } else { (new Image()).src = u; } } catch (e) {} }
    setInterval(hb, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) hb(); });
  } catch (e) {}
})();

/* Universal event tracker (2026-07-18): home.js defines a richer window.__mpTrack on the app-shell pages, but the
   bento homepage + every standalone page (which load mp-nav.js, NOT home.js) had no __mpTrack - so meaningful
   actions there (chat, sign-in, community, search…) never reached the live activity feed. This lightweight
   fallback closes that hole. Only defines if home.js hasn't already. */
(function () {
  try {
    if (window.__mpTrack) return;
    window.__mpTrack = function (t, e) {
      try {
        var u = '/api/track?t=' + encodeURIComponent(t) + (e ? '&e=' + encodeURIComponent(String(e).slice(0, 48)) : '') + '&p=' + encodeURIComponent(location.pathname);
        // money clicks carry the entry source (set by the pageview beacon earlier in the session)
        if (t === 'exchange' || t === 'tool') { try { var ms = sessionStorage.getItem('mp_src') || ''; if (!ms) { var f0 = JSON.parse(localStorage.getItem('mp_src0') || 'null'); if (f0 && f0.s && (Date.now() - (+f0.ts || 0)) <= 7776e6) ms = String(f0.s); } if (ms) u += '&src=' + encodeURIComponent(ms.slice(0, 40)); } catch (x2) {} }
        if (navigator.sendBeacon) navigator.sendBeacon(u); else (new Image()).src = u;
      } catch (x) {}
    };
  } catch (e) {}
})();
