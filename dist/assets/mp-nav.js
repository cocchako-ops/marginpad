/* MarginPad shared desktop nav — injects a top-left hamburger that opens a searchable left drawer.
   Self-contained (own CSS), desktop-only (≥721px). Loaded on standalone pages; the homepage has its own Browse panel. */
(function () {
  if (window.__mpNavLoaded) return; window.__mpNavLoaded = 1;
  var MPI = {"en":{"brBrowse":"Browse","brSearch":"Search pages, guides, coins…","brNoRes":"No matches for","secNew":"New here?","secTrade":"Trade","secEarn":"Earn","secMore":"More","brWtsT":"Where to start","brWtsS":"Crypto from zero — a free beginner path","prodPaper":"Paper Trade","brPaperS":"Practice at the live price · zero risk","brToolsT":"Trading Tools","brToolsS":"Backtester · journal · pivots · risk","prodScreener":"Screener","brScrS":"Live markets · movers, funding, OI","brMktsT":"Markets","brMktsS":"Top 100 coins · prices & market cap","brDefiT":"DeFi","brDefiS":"TVL, chains, protocols & stablecoins","brNewsT":"Crypto News","brNewsS":"Latest headlines · live","brFngT":"Fear & Greed","brFngS":"Live market sentiment","prodCharts":"Charts","prodChartsS":"Your windowed workspace","navRekt":"Rekt","prodRektS":"Live liquidations feed","brAlertsT":"Price Alerts","brAlertsS":"Email or Telegram when a coin hits your price","footTools":"Tools","brCalcT":"Calculators","brCalcS":"Liquidation, PnL, size & more","brFreeT":"Free USDT","brFreeS":"Claim every 5 minutes","navBlog":"Blog","navWidgets":"Widgets","navAbout":"About","navContact":"Contact","mnHome":"Home","mnBrowse":"Browse","mnPaper":"Practice","mnTrades":"Trades","mnChat":"Chat","brPages":"Pages & content","navMenu":"Menu","navClose":"Close","secCalc":"Calculators","brHeatT":"Liquidation Heatmap","brHeatS":"Coming soon — premium data feed","brSoon":"Soon","subLiq":"Liquidation price","subSize":"Position size","subPnl":"PnL / ROI","subDca":"DCA / average down","subTp":"Take-profit","subRr":"Risk / reward"},"de":{"brBrowse":"Entdecken","brSearch":"Seiten, Guides, Coins suchen…","brNoRes":"Keine Treffer für","secNew":"Neu hier?","secTrade":"Handeln","secEarn":"Verdienen","secMore":"Mehr","brWtsT":"Wo anfangen","brWtsS":"Krypto von null — ein kostenloser Einsteigerpfad","prodPaper":"Paper Trade","brPaperS":"Zum Live-Preis üben · null Risiko","brToolsT":"Trading-Tools","brToolsS":"Backtester · Journal · Pivots · Risiko","prodScreener":"Screener","brScrS":"Live-Märkte · Bewegungen, Funding, OI","brMktsT":"Märkte","brMktsS":"Top 100 Coins · Preise & Marktkap.","brDefiT":"DeFi","brDefiS":"TVL, Chains, Protokolle & Stablecoins","brNewsT":"Krypto-News","brNewsS":"Aktuelle Schlagzeilen · live","brFngT":"Angst & Gier","brFngS":"Live-Marktstimmung","prodCharts":"Charts","prodChartsS":"Dein Fenster-Workspace","navRekt":"Rekt","prodRektS":"Live-Liquidationen","brAlertsT":"Preisalarme","brAlertsS":"E-Mail oder Telegram, wenn ein Coin deinen Preis erreicht","footTools":"Tools","brCalcT":"Rechner","brCalcS":"Liquidation, PnL, Größe & mehr","brFreeT":"Gratis USDT","brFreeS":"Alle 5 Minuten beanspruchen","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Über","navContact":"Kontakt","mnHome":"Start","mnBrowse":"Stöbern","mnPaper":"Üben","mnTrades":"Trades","mnChat":"Chat","brPages":"Seiten & Inhalte","navMenu":"Menü","navClose":"Schließen","secCalc":"Rechner","brHeatT":"Liquidations-Heatmap","brHeatS":"Bald verfügbar — Premium-Datenfeed","brSoon":"Bald","subLiq":"Liquidationspreis","subSize":"Positionsgröße","subPnl":"PnL / ROI","subDca":"DCA / Nachkaufen","subTp":"Take-Profit","subRr":"Risiko / Rendite"},"es":{"brBrowse":"Explorar","brSearch":"Buscar páginas, guías, monedas…","brNoRes":"Sin resultados para","secNew":"¿Nuevo aquí?","secTrade":"Operar","secEarn":"Gana","secMore":"Más","brWtsT":"Por dónde empezar","brWtsS":"Cripto desde cero — una ruta gratuita para principiantes","prodPaper":"Operar en Demo","brPaperS":"Practica al precio en vivo · sin riesgo","brToolsT":"Herramientas de trading","brToolsS":"Backtester · diario · pivotes · riesgo","prodScreener":"Screener","brScrS":"Mercados en vivo · movimientos, funding, OI","brMktsT":"Mercados","brMktsS":"Top 100 monedas · precios y cap. de mercado","brDefiT":"DeFi","brDefiS":"TVL, cadenas, protocolos y stablecoins","brNewsT":"Noticias cripto","brNewsS":"Últimos titulares · en vivo","brFngT":"Miedo y codicia","brFngS":"Sentimiento del mercado en vivo","prodCharts":"Gráficos","prodChartsS":"Tu espacio en ventanas","navRekt":"Rekt","prodRektS":"Liquidaciones en vivo","brAlertsT":"Alertas de precio","brAlertsS":"Email o Telegram cuando una moneda alcance tu precio","footTools":"Herramientas","brCalcT":"Calculadoras","brCalcS":"Liquidación, PnL, tamaño y más","brFreeT":"USDT gratis","brFreeS":"Reclama cada 5 minutos","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Acerca de","navContact":"Contacto","mnHome":"Inicio","mnBrowse":"Explorar","mnPaper":"Practicar","mnTrades":"Trades","mnChat":"Chat","brPages":"Páginas y contenido","navMenu":"Menú","navClose":"Cerrar","secCalc":"Calculadoras","brHeatT":"Mapa de calor de liquidaciones","brHeatS":"Próximamente — feed de datos premium","brSoon":"Pronto","subLiq":"Precio de liquidación","subSize":"Tamaño de posición","subPnl":"PnL / ROI","subDca":"DCA / promediar a la baja","subTp":"Take-profit","subRr":"Riesgo / beneficio"},"pt":{"brBrowse":"Explorar","brSearch":"Buscar páginas, guias, moedas…","brNoRes":"Sem resultados para","secNew":"Novo por aqui?","secTrade":"Operar","secEarn":"Ganhe","secMore":"Mais","brWtsT":"Por onde começar","brWtsS":"Cripto do zero — um caminho gratuito para iniciantes","prodPaper":"Operar em Demo","brPaperS":"Pratique no preço ao vivo · risco zero","brToolsT":"Ferramentas de trading","brToolsS":"Backtester · diário · pivôs · risco","prodScreener":"Screener","brScrS":"Mercados ao vivo · variações, funding, OI","brMktsT":"Mercados","brMktsS":"Top 100 moedas · preços e cap. de mercado","brDefiT":"DeFi","brDefiS":"TVL, redes, protocolos e stablecoins","brNewsT":"Notícias cripto","brNewsS":"Últimas manchetes · ao vivo","brFngT":"Medo e ganância","brFngS":"Sentimento do mercado ao vivo","prodCharts":"Gráficos","prodChartsS":"Seu espaço em janelas","navRekt":"Rekt","prodRektS":"Liquidações ao vivo","brAlertsT":"Alertas de preço","brAlertsS":"E-mail ou Telegram quando uma moeda atingir seu preço","footTools":"Ferramentas","brCalcT":"Calculadoras","brCalcS":"Liquidação, PnL, tamanho e mais","brFreeT":"USDT grátis","brFreeS":"Resgate a cada 5 minutos","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Sobre","navContact":"Contato","mnHome":"Início","mnBrowse":"Explorar","mnPaper":"Praticar","mnTrades":"Trades","mnChat":"Chat","brPages":"Páginas e conteúdo","navMenu":"Menu","navClose":"Fechar","secCalc":"Calculadoras","brHeatT":"Mapa de calor de liquidações","brHeatS":"Em breve — feed de dados premium","brSoon":"Em breve","subLiq":"Preço de liquidação","subSize":"Tamanho da posição","subPnl":"PnL / ROI","subDca":"DCA / preço médio","subTp":"Take-profit","subRr":"Risco / retorno"},"fr":{"brBrowse":"Explorer","brSearch":"Rechercher pages, guides, cryptos…","brNoRes":"Aucun résultat pour","secNew":"Nouveau ici ?","secTrade":"Trader","secEarn":"Gagner","secMore":"Plus","brWtsT":"Par où commencer","brWtsS":"La crypto de zéro — un parcours débutant gratuit","prodPaper":"Trader en Démo","brPaperS":"Pratiquez au prix réel · zéro risque","brToolsT":"Outils de trading","brToolsS":"Backtester · journal · pivots · risque","prodScreener":"Screener","brScrS":"Marchés en direct · variations, funding, OI","brMktsT":"Marchés","brMktsS":"Top 100 cryptos · prix et capitalisation","brDefiT":"DeFi","brDefiS":"TVL, chaînes, protocoles et stablecoins","brNewsT":"Actus crypto","brNewsS":"Derniers titres · en direct","brFngT":"Peur et avidité","brFngS":"Sentiment du marché en direct","prodCharts":"Graphiques","prodChartsS":"Votre espace en fenêtres","navRekt":"Rekt","prodRektS":"Liquidations en direct","brAlertsT":"Alertes de prix","brAlertsS":"E-mail ou Telegram quand une crypto atteint votre prix","footTools":"Outils","brCalcT":"Calculatrices","brCalcS":"Liquidation, PnL, taille et plus","brFreeT":"USDT gratuit","brFreeS":"Réclamez toutes les 5 minutes","navBlog":"Blog","navWidgets":"Widgets","navAbout":"À propos","navContact":"Contact","mnHome":"Accueil","mnBrowse":"Parcourir","mnPaper":"S'entraîner","mnTrades":"Trades","mnChat":"Chat","brPages":"Pages et contenu","navMenu":"Menu","navClose":"Fermer","secCalc":"Calculatrices","brHeatT":"Heatmap des liquidations","brHeatS":"Bientôt — flux de données premium","brSoon":"Bientôt","subLiq":"Prix de liquidation","subSize":"Taille de position","subPnl":"PnL / ROI","subDca":"DCA / moyenne à la baisse","subTp":"Take-profit","subRr":"Risque / rendement"},"nl":{"brBrowse":"Verkennen","brSearch":"Zoek pagina's, gidsen, coins…","brNoRes":"Geen resultaten voor","secNew":"Nieuw hier?","secTrade":"Handelen","secEarn":"Verdien","secMore":"Meer","brWtsT":"Waar te beginnen","brWtsS":"Crypto vanaf nul — een gratis pad voor beginners","prodPaper":"Paper Trade","brPaperS":"Oefen tegen de live prijs · nul risico","brToolsT":"Trading-tools","brToolsS":"Backtester · dagboek · pivots · risico","prodScreener":"Screener","brScrS":"Live markten · stijgers, funding, OI","brMktsT":"Markten","brMktsS":"Top 100 coins · prijzen & marktkap","brDefiT":"DeFi","brDefiS":"TVL, chains, protocollen & stablecoins","brNewsT":"Crypto-nieuws","brNewsS":"Laatste koppen · live","brFngT":"Angst & hebzucht","brFngS":"Live marktsentiment","prodCharts":"Grafieken","prodChartsS":"Je venster-werkruimte","navRekt":"Rekt","prodRektS":"Live liquidaties","brAlertsT":"Prijsalerts","brAlertsS":"E-mail of Telegram als een coin jouw prijs raakt","footTools":"Tools","brCalcT":"Calculators","brCalcS":"Liquidatie, PnL, omvang & meer","brFreeT":"Gratis USDT","brFreeS":"Claim elke 5 minuten","navBlog":"Blog","navWidgets":"Widgets","navAbout":"Over","navContact":"Contact","mnHome":"Home","mnBrowse":"Bladeren","mnPaper":"Oefenen","mnTrades":"Trades","mnChat":"Chat","brPages":"Pagina's & inhoud","navMenu":"Menu","navClose":"Sluiten","secCalc":"Calculators","brHeatT":"Liquidatie-heatmap","brHeatS":"Binnenkort — premium datafeed","brSoon":"Binnenkort","subLiq":"Liquidatieprijs","subSize":"Positiegrootte","subPnl":"PnL / ROI","subDca":"DCA / bijkopen","subTp":"Take-profit","subRr":"Risico / rendement"},"ru":{"brBrowse":"Обзор","brSearch":"Поиск страниц, гайдов, монет…","brNoRes":"Нет совпадений для","secNew":"Впервые здесь?","secTrade":"Торговля","secEarn":"Заработок","secMore":"Ещё","brWtsT":"С чего начать","brWtsS":"Крипто с нуля — бесплатный путь для новичков","prodPaper":"Демо-торговля","brPaperS":"Практика по реальной цене · без риска","brToolsT":"Торговые инструменты","brToolsS":"Бэктестер · журнал · пивоты · риск","prodScreener":"Скринер","brScrS":"Рынки в реальном времени · движения, фандинг, OI","brMktsT":"Рынки","brMktsS":"Топ-100 монет · цены и капитализация","brDefiT":"DeFi","brDefiS":"TVL, сети, протоколы и стейблкоины","brNewsT":"Крипто-новости","brNewsS":"Последние заголовки · в реальном времени","brFngT":"Страх и жадность","brFngS":"Настроение рынка в реальном времени","prodCharts":"Графики","prodChartsS":"Ваше оконное рабочее место","navRekt":"Rekt","prodRektS":"Лента ликвидаций в реальном времени","brAlertsT":"Ценовые оповещения","brAlertsS":"E-mail или Telegram, когда монета достигнет вашей цены","footTools":"Инструменты","brCalcT":"Калькуляторы","brCalcS":"Ликвидация, PnL, размер и не только","brFreeT":"Бесплатный USDT","brFreeS":"Забирайте каждые 5 минут","navBlog":"Блог","navWidgets":"Виджеты","navAbout":"О нас","navContact":"Контакты","mnHome":"Главная","mnBrowse":"Обзор","mnPaper":"Практика","mnTrades":"Сделки","mnChat":"Чат","brPages":"Страницы и контент","navMenu":"Меню","navClose":"Закрыть","secCalc":"Калькуляторы","brHeatT":"Тепловая карта ликвидаций","brHeatS":"Скоро — премиум-данные","brSoon":"Скоро","subLiq":"Цена ликвидации","subSize":"Размер позиции","subPnl":"PnL / ROI","subDca":"DCA / усреднение","subTp":"Тейк-профит","subRr":"Риск / прибыль"},"tr":{"brBrowse":"Keşfet","brSearch":"Sayfa, rehber, coin ara…","brNoRes":"Sonuç yok:","secNew":"Yeni misin?","secTrade":"İşlem","secEarn":"Kazan","secMore":"Daha fazla","brWtsT":"Nereden başlamalı","brWtsS":"Sıfırdan kripto — ücretsiz başlangıç yolu","prodPaper":"Demo İşlem","brPaperS":"Canlı fiyattan pratik yap · sıfır risk","brToolsT":"İşlem araçları","brToolsS":"Backtester · günlük · pivotlar · risk","prodScreener":"Tarayıcı","brScrS":"Canlı piyasalar · hareketler, funding, OI","brMktsT":"Piyasalar","brMktsS":"İlk 100 coin · fiyatlar ve piyasa değeri","brDefiT":"DeFi","brDefiS":"TVL, zincirler, protokoller ve stablecoinler","brNewsT":"Kripto haberleri","brNewsS":"Son başlıklar · canlı","brFngT":"Korku ve açgözlülük","brFngS":"Canlı piyasa duyarlılığı","prodCharts":"Grafikler","prodChartsS":"Pencereli çalışma alanınız","navRekt":"Rekt","prodRektS":"Canlı likidasyon akışı","brAlertsT":"Fiyat alarmları","brAlertsS":"Bir coin fiyatına ulaşınca e-posta veya Telegram","footTools":"Araçlar","brCalcT":"Hesaplayıcılar","brCalcS":"Likidasyon, PnL, boyut ve daha fazlası","brFreeT":"Ücretsiz USDT","brFreeS":"Her 5 dakikada bir al","navBlog":"Blog","navWidgets":"Widget'lar","navAbout":"Hakkında","navContact":"İletişim","mnHome":"Ana Sayfa","mnBrowse":"Gözat","mnPaper":"Pratik","mnTrades":"İşlemler","mnChat":"Sohbet","brPages":"Sayfalar ve içerik","navMenu":"Menü","navClose":"Kapat","secCalc":"Hesaplayıcılar","brHeatT":"Likidasyon ısı haritası","brHeatS":"Yakında — premium veri akışı","brSoon":"Yakında","subLiq":"Likidasyon fiyatı","subSize":"Pozisyon boyutu","subPnl":"PnL / ROI","subDca":"DCA / ortalama düşürme","subTp":"Kâr al","subRr":"Risk / ödül"},"zh":{"brBrowse":"浏览","brSearch":"搜索页面、指南、币种…","brNoRes":"未找到","secNew":"新手？","secTrade":"交易","secEarn":"赚取","secMore":"更多","brWtsT":"从何开始","brWtsS":"从零开始学加密 — 免费新手路径","prodPaper":"模拟交易","brPaperS":"按实时价格练习 · 零风险","brToolsT":"交易工具","brToolsS":"回测 · 日志 · 枢轴点 · 风险","prodScreener":"选币器","brScrS":"实时行情 · 涨跌、资金费率、持仓量","brMktsT":"行情","brMktsS":"前100币种 · 价格与市值","brDefiT":"DeFi","brDefiS":"TVL、链、协议与稳定币","brNewsT":"加密新闻","brNewsS":"最新头条 · 实时","brFngT":"恐惧与贪婪","brFngS":"实时市场情绪","prodCharts":"图表","prodChartsS":"你的窗口化工作区","navRekt":"爆仓","prodRektS":"实时强平动态","brAlertsT":"价格提醒","brAlertsS":"币种达到你的价格时邮件或 Telegram 通知","footTools":"工具","brCalcT":"计算器","brCalcS":"强平、盈亏、仓位大小等","brFreeT":"免费 USDT","brFreeS":"每5分钟领取","navBlog":"博客","navWidgets":"小组件","navAbout":"关于","navContact":"联系","mnHome":"首页","mnBrowse":"浏览","mnPaper":"练习","mnTrades":"交易","mnChat":"聊天","brPages":"页面与内容","navMenu":"菜单","navClose":"关闭","secCalc":"计算器","brHeatT":"强平热力图","brHeatS":"即将推出 — 高级数据源","brSoon":"即将推出","subLiq":"强平价格","subSize":"仓位大小","subPnl":"盈亏 / ROI","subDca":"定投 / 摊低成本","subTp":"止盈","subRr":"风险 / 回报"},"ja":{"brBrowse":"見る","brSearch":"ページ・ガイド・銘柄を検索…","brNoRes":"該当なし:","secNew":"はじめての方へ","secTrade":"取引","secEarn":"稼ぐ","secMore":"その他","brWtsT":"どこから始める","brWtsS":"ゼロから学ぶ暗号資産 — 無料の初心者ガイド","prodPaper":"ペーパートレード","brPaperS":"ライブ価格で練習 · リスクゼロ","brToolsT":"トレードツール","brToolsS":"バックテスト · 日誌 · ピボット · リスク","prodScreener":"スクリーナー","brScrS":"ライブ市場 · 値動き、資金調達率、OI","brMktsT":"マーケット","brMktsS":"トップ100銘柄 · 価格と時価総額","brDefiT":"DeFi","brDefiS":"TVL、チェーン、プロトコル、ステーブルコイン","brNewsT":"暗号資産ニュース","brNewsS":"最新ヘッドライン · ライブ","brFngT":"恐怖と強欲","brFngS":"ライブ市場センチメント","prodCharts":"チャート","prodChartsS":"ウィンドウ式ワークスペース","navRekt":"清算","prodRektS":"ライブ清算フィード","brAlertsT":"価格アラート","brAlertsS":"銘柄が指定価格に達したらメールまたはTelegramで通知","footTools":"ツール","brCalcT":"計算ツール","brCalcS":"清算・損益・数量など","brFreeT":"無料USDT","brFreeS":"5分ごとに受け取り","navBlog":"ブログ","navWidgets":"ウィジェット","navAbout":"概要","navContact":"お問い合わせ","mnHome":"ホーム","mnBrowse":"見る","mnPaper":"練習","mnTrades":"取引","mnChat":"チャット","brPages":"ページとコンテンツ","navMenu":"メニュー","navClose":"閉じる","secCalc":"計算ツール","brHeatT":"清算ヒートマップ","brHeatS":"近日公開 — プレミアムデータ","brSoon":"近日公開","subLiq":"清算価格","subSize":"ポジションサイズ","subPnl":"損益 / ROI","subDca":"DCA / ナンピン","subTp":"利確","subRr":"リスク / リワード"},"ko":{"brBrowse":"둘러보기","brSearch":"페이지·가이드·코인 검색…","brNoRes":"검색 결과 없음:","secNew":"처음이신가요?","secTrade":"거래","secEarn":"적립","secMore":"더보기","brWtsT":"어디서 시작할까","brWtsS":"제로부터 배우는 크립토 — 무료 입문 코스","prodPaper":"모의 거래","brPaperS":"실시간 가격으로 연습 · 무위험","brToolsT":"트레이딩 도구","brToolsS":"백테스터 · 일지 · 피벗 · 리스크","prodScreener":"스크리너","brScrS":"실시간 시장 · 변동, 펀딩, OI","brMktsT":"마켓","brMktsS":"상위 100 코인 · 가격과 시가총액","brDefiT":"DeFi","brDefiS":"TVL, 체인, 프로토콜, 스테이블코인","brNewsT":"크립토 뉴스","brNewsS":"최신 헤드라인 · 실시간","brFngT":"공포와 탐욕","brFngS":"실시간 시장 심리","prodCharts":"차트","prodChartsS":"창 분할 작업공간","navRekt":"청산","prodRektS":"실시간 청산 피드","brAlertsT":"가격 알림","brAlertsS":"코인이 지정 가격에 도달하면 이메일 또는 텔레그램","footTools":"도구","brCalcT":"계산기","brCalcS":"청산, 손익, 규모 등","brFreeT":"무료 USDT","brFreeS":"5분마다 받기","navBlog":"블로그","navWidgets":"위젯","navAbout":"소개","navContact":"문의","mnHome":"홈","mnBrowse":"둘러보기","mnPaper":"연습","mnTrades":"거래","mnChat":"채팅","brPages":"페이지 및 콘텐츠","navMenu":"메뉴","navClose":"닫기","secCalc":"계산기","brHeatT":"청산 히트맵","brHeatS":"곧 출시 — 프리미엄 데이터","brSoon":"곧 출시","subLiq":"청산 가격","subSize":"포지션 규모","subPnl":"손익 / ROI","subDca":"DCA / 물타기","subTp":"익절","subRr":"위험 / 보상"},"ar":{"brBrowse":"تصفح","brSearch":"ابحث عن صفحات وأدلة وعملات…","brNoRes":"لا نتائج لـ","secNew":"جديد هنا؟","secTrade":"تداول","secEarn":"اربح","secMore":"المزيد","brWtsT":"من أين تبدأ","brWtsS":"العملات الرقمية من الصفر — مسار مجاني للمبتدئين","prodPaper":"تداول تجريبي","brPaperS":"تدرّب بالسعر المباشر · بدون مخاطر","brToolsT":"أدوات التداول","brToolsS":"اختبار رجعي · سجل · نقاط محورية · مخاطر","prodScreener":"الماسح","brScrS":"أسواق مباشرة · التحركات والتمويل والمراكز المفتوحة","brMktsT":"الأسواق","brMktsS":"أفضل 100 عملة · الأسعار والقيمة السوقية","brDefiT":"DeFi","brDefiS":"القيمة المقفلة والشبكات والبروتوكولات والعملات المستقرة","brNewsT":"أخبار الكريبتو","brNewsS":"أحدث العناوين · مباشر","brFngT":"الخوف والطمع","brFngS":"مزاج السوق المباشر","prodCharts":"الرسوم البيانية","prodChartsS":"مساحة عملك المنبثقة","navRekt":"تصفيات","prodRektS":"بث التصفيات الحي","brAlertsT":"تنبيهات السعر","brAlertsS":"بريد إلكتروني أو تيليجرام عند وصول العملة إلى سعرك","footTools":"الأدوات","brCalcT":"الحاسبات","brCalcS":"التصفية والربح/الخسارة والحجم والمزيد","brFreeT":"USDT مجاني","brFreeS":"احصل كل 5 دقائق","navBlog":"المدونة","navWidgets":"الأدوات المصغّرة","navAbout":"حول","navContact":"تواصل","mnHome":"الرئيسية","mnBrowse":"تصفّح","mnPaper":"تدرّب","mnTrades":"الصفقات","mnChat":"دردشة","brPages":"الصفحات والمحتوى","navMenu":"القائمة","navClose":"إغلاق","secCalc":"الحاسبات","brHeatT":"خريطة حرارية للتصفيات","brHeatS":"قريباً — تغذية بيانات مميزة","brSoon":"قريباً","subLiq":"سعر التصفية","subSize":"حجم المركز","subPnl":"الربح/الخسارة / العائد","subDca":"متوسط التكلفة / التعزيز","subTp":"جني الأرباح","subRr":"المخاطرة / العائد"},"id":{"brBrowse":"Jelajahi","brSearch":"Cari halaman, panduan, koin…","brNoRes":"Tidak ada hasil untuk","secNew":"Baru di sini?","secTrade":"Trading","secEarn":"Hasilkan","secMore":"Lainnya","brWtsT":"Mulai dari mana","brWtsS":"Kripto dari nol — jalur pemula gratis","prodPaper":"Paper Trade","brPaperS":"Berlatih di harga live · tanpa risiko","brToolsT":"Alat trading","brToolsS":"Backtester · jurnal · pivot · risiko","prodScreener":"Screener","brScrS":"Pasar live · pergerakan, funding, OI","brMktsT":"Pasar","brMktsS":"100 koin teratas · harga & kap. pasar","brDefiT":"DeFi","brDefiS":"TVL, chain, protokol & stablecoin","brNewsT":"Berita kripto","brNewsS":"Berita terbaru · live","brFngT":"Takut & serakah","brFngS":"Sentimen pasar live","prodCharts":"Grafik","prodChartsS":"Ruang kerja berjendela","navRekt":"Rekt","prodRektS":"Feed likuidasi live","brAlertsT":"Peringatan harga","brAlertsS":"Email atau Telegram saat koin mencapai harga Anda","footTools":"Alat","brCalcT":"Kalkulator","brCalcS":"Likuidasi, PnL, ukuran & lainnya","brFreeT":"USDT gratis","brFreeS":"Klaim tiap 5 menit","navBlog":"Blog","navWidgets":"Widget","navAbout":"Tentang","navContact":"Kontak","mnHome":"Beranda","mnBrowse":"Jelajah","mnPaper":"Latihan","mnTrades":"Trade","mnChat":"Chat","brPages":"Halaman & konten","navMenu":"Menu","navClose":"Tutup","secCalc":"Kalkulator","brHeatT":"Heatmap likuidasi","brHeatS":"Segera hadir — feed data premium","brSoon":"Segera","subLiq":"Harga likuidasi","subSize":"Ukuran posisi","subPnl":"PnL / ROI","subDca":"DCA / average down","subTp":"Take-profit","subRr":"Risiko / imbalan"}};
  function _mpLang(){var m=(location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)||[])[1];if(m&&MPI[m])return m;try{var u=new URLSearchParams(location.search).get('lang');if(u&&MPI[u])return u;}catch(e){}try{var sv=localStorage.getItem('mp_lang');if(sv&&MPI[sv])return sv;}catch(e){}return 'en';}
  var _NL=_mpLang();
  function TR(k){var o=MPI[_NL]||MPI.en;return (o&&o[k]!=null)?o[k]:(MPI.en[k]!=null?MPI.en[k]:k);}
  var css = ''
    + '@view-transition{navigation:auto;}' /* smooth cross-page crossfade on supported browsers (progressive — others just navigate) */
    + '.mpnav-burger{display:none;position:fixed;top:13px;left:13px;z-index:90;flex-direction:column;justify-content:center;gap:4px;width:38px;height:38px;padding:0 8px;background:rgba(10,11,13,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:10px;cursor:pointer;}'
    + '.mpnav-burger span{display:block;height:2.5px;width:20px;border-radius:2px;background:#c2f64a;box-shadow:0 0 6px rgba(194,246,74,.5);transition:.2s;}'
    + '.mpnav-burger span:nth-child(2){width:14px;}'
    + '.mpnav-burger:hover span{box-shadow:0 0 10px rgba(194,246,74,.9);width:20px;}'
    + '@media(min-width:721px){.mpnav-burger{display:inline-flex;}header .brand{margin-left:46px;}}'  /* burger (drawer access) is DESKTOP-only now — on mobile the bottom bar has Browse, and the fixed burger was covering the logo */
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
    + ".mpnav-sec{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#5c656f;margin:18px 6px 9px;}"
    + '.mpnav-row{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:#111419;border:1px solid #232932;border-radius:14px;padding:14px 16px;margin-bottom:9px;color:#e9e7df;text-decoration:none;transition:transform .12s,background .12s;}'
    + '.mpnav-row:hover{background:#161a20;}.mpnav-row:active{transform:scale(.985);}'
    + '.mpnav-ic{flex-shrink:0;width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;}.mpnav-ic svg{width:21px;height:21px;display:block;}'
    + '.mpnav-rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}'
    + ".mpnav-rt b{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15.5px;}"
    + '.mpnav-rt small{color:#7f8893;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.mpnav-more{display:flex;flex-wrap:wrap;gap:8px;}'
    + '.mpnav-mrow{flex:1 1 calc(50% - 8px);display:flex;align-items:center;gap:9px;background:#111419;border:1px solid #232932;border-radius:12px;padding:11px 12px;color:#9aa3ad;text-decoration:none;font-size:14px;}'
    + '.mpnav-mrow svg{width:16px;height:16px;flex:0 0 auto;color:#7f8893;}'
    + '.mpnav-mrow:hover{color:#e9e7df;}'
    /* expandable Calculators row + sub-links, disabled "Soon" row, Soon/New badges — match the homepage Browse */
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
    /* ===== homepage-style bottom mobile nav bar (mobile only) — gives every standalone page the same nav as the homepage ===== */
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
    +   'body>.wrap>header,body>header{position:sticky;top:0;z-index:50;padding-top:calc(env(safe-area-inset-top) + 14px) !important;padding-bottom:12px !important;background:#0a0b0d;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:6px;}'   /* solid bg (no 100vw / no backdrop-filter — both are iOS WebKit hazards) */
    +   'body>.wrap>header .brand,body>header .brand{margin-left:0;}'   /* no burger on mobile → logo sits at its natural left edge */
    +   '.mpnav-burger{top:calc(env(safe-area-inset-top) + 9px);}'
    + '}';
  // WEAK-PHONE GPU RESCUE: kill backdrop-filter:blur on mobile (old WebViews freeze the compositor on blurred elements). Solid bottom bar for legibility.
  css += '@media(max-width:760px){*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}.mpbn{background:#0c1109 !important;}}';
  // ===== canonical desktop header (homepage-identical) for standalone pages that lack it — applied by normalizeHeader() =====
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
    + '@media(max-width:720px){header.mpnav-hdr .hbot,header.mpnav-hdr .hjr{display:none;}header.mpnav-hdr .hauth span{display:none;}header.mpnav-hdr .hauth{padding:7px;}header.mpnav-hdr .hnav{gap:2px;}header.mpnav-hdr .lang{max-width:64px;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var I = {
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    scr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3.5" y1="6" x2="3.51" y2="6"/><line x1="3.5" y1="12" x2="3.51" y2="12"/><line x1="3.5" y1="18" x2="3.51" y2="18"/></svg>',
    mkt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    heat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1H5a1 1 0 0 1-1-1z"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><line x1="7" y1="8" x2="14" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="16" x2="11" y2="16"/></svg>',
    fng: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4.2-4.2"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>',
    charts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>',
    rekt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="18" x2="16" y2="18"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1V10"/></svg>',
    defi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
    tools: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/></svg>',
    start: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5"/></svg>',
    bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:#5c656f;flex-shrink:0"><path d="M9 18l6-6-6-6"/></svg>'
  };
  function row(tKey, sKey, href, c, ic) { return '<a class="mpnav-row" href="' + href + '"><span class="mpnav-ic" style="color:' + c + ';background:' + c + '22">' + I[ic] + '</span><span class="mpnav-rt"><b>' + TR(tKey) + '</b><small>' + TR(sKey) + '</small></span>' + I.chev + '</a>'; }
  var html = '<div class="mpnav-sheet"><div class="mpnav-head"><span class="mpnav-title">'+TR('brBrowse')+'</span><button type="button" class="mpnav-x" aria-label="'+TR('navClose')+'">&#10005;</button></div>'
    + '<div class="mpnav-sw"><input type="text" class="mpnav-search" placeholder="'+TR('brSearch')+'" autocomplete="off" aria-label="Search"></div>'
    + '<div class="mpnav-scroll">'
    + '<div class="mpnav-sugg" id="mpnavSugg" hidden></div>'
    + '<div class="mpnav-sec">'+TR('secNew')+'</div>'
    + row('brWtsT', 'brWtsS', '/where-to-start/', '#c2f64a', 'start')
    + '<div class="mpnav-sec">'+TR('secCalc')+'</div>'
    + '<button type="button" class="mpnav-row mpnav-expand" data-mpexpand="calc"><span class="mpnav-ic" style="color:#c2f64a;background:#c2f64a22">'+I.calc+'</span><span class="mpnav-rt"><b>'+TR('brCalcT')+'</b><small>'+TR('brCalcS')+'</small></span>'+I.chev+'</button>'
    + '<div class="mpnav-sub" data-sub="calc" hidden>'
    +   '<a class="mpnav-subrow" href="/calculators?c=liq">'+TR('subLiq')+'</a>'
    +   '<a class="mpnav-subrow" href="/calculators?c=size">'+TR('subSize')+'</a>'
    +   '<a class="mpnav-subrow" href="/calculators?c=pnl">'+TR('subPnl')+'</a>'
    +   '<a class="mpnav-subrow" href="/calculators?c=dca">'+TR('subDca')+'</a>'
    +   '<a class="mpnav-subrow" href="/calculators?c=tp">'+TR('subTp')+'</a>'
    +   '<a class="mpnav-subrow" href="/calculators?c=rr">'+TR('subRr')+'</a>'
    + '</div>'
    + '<div class="mpnav-sec">'+TR('secTrade')+'</div>'
    + row('prodPaper', 'brPaperS', '/paper-trade', '#2ebd85', 'plan')
    + row('brToolsT', 'brToolsS', '/tools/', '#46e0e6', 'tools')
    + row('Bot API', 'Test your trading bot free · REST API', '/trading-api/', '#3fd8e6', 'bot')
    + row('prodScreener', 'brScrS', '/screener', '#6aa3ff', 'scr')
    + row('brMktsT', 'brMktsS', '/coins/', '#16c2d6', 'mkt')
    + row('brDefiT', 'brDefiS', '/defi/', '#9d7bff', 'defi')
    + row('brNewsT', 'brNewsS', '/news/', '#ff8c5a', 'news')
    + row('brFngT', 'brFngS', '/fear-greed/', '#7fd957', 'fng')
    + row('prodCharts', 'prodChartsS', '/charts', '#3fd8e6', 'charts')
    + '<div class="mpnav-row mpnav-soon"><span class="mpnav-ic" style="color:#ffb347;background:#ffb34722">'+I.heat+'</span><span class="mpnav-rt"><b>'+TR('brHeatT')+' <em class="mpnav-badge">'+TR('brSoon')+'</em></b><small>'+TR('brHeatS')+'</small></span></div>'
    + row('navRekt', 'prodRektS', '/rekt/', '#ff6258', 'rekt')
    + row('brAlertsT', 'brAlertsS', '/alerts/', '#c2f64a', 'alert')
    + '<div class="mpnav-sec">'+TR('secEarn')+'</div>'
    + row('brFreeT', 'brFreeS', '/rewards/', '#ffd75a', 'gift')
    + '<div class="mpnav-sec">'+TR('secMore')+'</div><div class="mpnav-more">'
    + '<a class="mpnav-mrow" href="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1V10"/></svg>'+TR('mnHome')+'</a>'
    + '<a class="mpnav-mrow" href="/blog/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1H5a1 1 0 0 1-1-1z"/><line x1="7" y1="8" x2="14" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="16" x2="11" y2="16"/></svg>'+TR('navBlog')+'</a>'
    + '<a class="mpnav-mrow" href="https://t.me/MarginPadBot" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Telegram</a>'
    + '<a class="mpnav-mrow" href="/api/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>API</a>'
    + '<a class="mpnav-mrow" href="/widgets/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'+TR('navWidgets')+'</a>'
    + '<a class="mpnav-mrow" href="/about/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/></svg>'+TR('navAbout')+'</a>'
    + '<a class="mpnav-mrow" href="/contact/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'+TR('navContact')+'</a>'
    + '</div></div></div>';

  var btn = document.createElement('button'); btn.className = 'mpnav-burger'; btn.setAttribute('aria-label', TR('navMenu')); btn.innerHTML = '<span></span><span></span><span></span>';
  var panel = document.createElement('div'); panel.className = 'mpnav'; panel.hidden = true; panel.innerHTML = html;
  // homepage-style bottom mobile nav bar (Browse / Home / Practice / Trades / Chat) — same look as the homepage on every standalone page
  function bottomBar() {
    var S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var items = [
      ['browse', 'Browse', 'mnBrowse', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
      ['/paper-trade', 'Practice', 'mnPaper', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'],
      ['/paper-trade?trades=1', 'Trades', 'mnTrades', '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'],
      ['/', 'Chat', 'mnChat', '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"/>']
    ];
    var path = location.pathname.replace(/\/$/, '') || '/';
    var keys = { Browse: 'browse', Practice: 'practice', Trades: 'trades', Chat: 'chat' };
    var bn = document.createElement('nav'); bn.className = 'mpbn'; bn.setAttribute('aria-label', 'Quick navigation');
    bn.innerHTML = items.map(function (it) {
      var browse = it[0] === 'browse';
      // match the FULL href (path + query) — else "/paper-trade" and "/paper-trade?trades=1" both lit up on /paper-trade (Trades glowed wrongly)
      var iq = it[0].indexOf('?') >= 0 ? it[0].slice(it[0].indexOf('?')) : '';
      var cur = (!browse && (it[0].split('?')[0].replace(/\/$/, '') || '/') === path && iq === (location.search || '')) ? ' cur' : '';
      return '<a href="' + (browse ? '#' : it[0]) + '" data-mpbn="' + keys[it[1]] + '"' + (browse ? ' role="button"' : '') + ' class="mpbn-i' + cur + '" aria-label="' + TR(it[2]) + '"><svg viewBox="0 0 24 24" width="22" height="22" ' + S + '>' + it[3] + '</svg><span class="mpbn-l">' + TR(it[2]) + '</span></a>';
    }).join('');
    return bn;
  }
  // ===== give every standalone page the SAME desktop header as the homepage =====
  function canonHeaderHTML() {
    var opts = [['/', 'EN'], ['/es/', 'ES'], ['/de/', 'DE'], ['/fr/', 'FR'], ['/it/', 'IT'], ['/pt/', 'PT'], ['/pl/', 'PL'], ['/nl/', 'NL'], ['/tr/', 'TR'], ['/ru/', 'RU'], ['/id/', 'ID'], ['/hi/', 'HI'], ['/vi/', 'VI']];
    var lo = opts.map(function (o) { var code = o[0] === '/' ? 'en' : o[0].replace(/\//g, ''); return '<option value="' + o[0] + '"' + (code === _NL ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    return '<div class="brand"><button type="button" class="hmenu" id="mBurger" aria-label="' + TR('navMenu') + '"><span></span><span></span><span></span></button>'
      + '<a href="/" class="mark" aria-label="MarginPad — home">MARGIN<b>PAD</b></a></div>'
      + '<nav class="hnav">'
      + '<a href="https://t.me/MarginPadBot" target="_blank" rel="noopener" class="hlink hbot"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>Bot</a>'
      + '<a href="/rewards/" class="hlink hrwd" title="Free USDT — claim every 5 min"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>Rewards</a>'
      + '<a href="/paper-trade?trades=1" class="hlink hjr"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>My Trades</a>'
      + '<button type="button" class="hlink hauth" data-auth-open aria-label="Sign in"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span data-auth-status>Sign in</span></button>'
      + '<select class="lang" id="langSel" aria-label="Language">' + lo + '</select></nav>';
  }
  function normalizeHeader() {
    try {
      if (document.querySelector('header .hrwd')) return; // already the canonical header (homepage / app-shell / defi / rekt / rewards)
      var h = document.querySelector('body>header') || document.querySelector('body>.wrap>header');
      if (!h) return;
      // only a simple site header (brand + a few nav links) is safe to rebuild — never one carrying a widget
      if (h.querySelector('input,form,canvas,table,.tabs,[role="tablist"]')) return;
      h.classList.add('mpnav-hdr');
      h.innerHTML = canonHeaderHTML();
      var mb = h.querySelector('#mBurger'); if (mb) mb.addEventListener('click', open);   // header burger opens the shared drawer (mp-auth handles [data-auth-open] by delegation)
      var ls = h.querySelector('#langSel'); if (ls) ls.addEventListener('change', function () { if (ls.value) location.href = ls.value; });
    } catch (e) {}
  }
  function mount() { if (!document.body) return;
    normalizeHeader();
    // Pages that already have their OWN header burger (homepage / lang homepages / defi / app-shell = .hmenu/#mBurger)
    // must not SHOW a 2nd one — but their burger opens this drawer by .click()-ing mp-nav's burger, so we still append it
    // as an INVISIBLE click target (display:none), plus window.mpNavOpen. Removing it entirely broke those pages' openBrowse.
    var hasOwnBurger = document.querySelector('.hmenu, #mBurger');
    if (hasOwnBurger) btn.style.display = 'none';
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    // THE one mobile bar — mp-nav owns it SITE-WIDE. Any legacy inline bar (.mobnav variants on the old
    // homepage/app-shell/rekt/rewards, .smobnav on hub pages) is removed so every page shows the SAME four
    // items in the same order. Navigation is habit — it must never differ between pages (owner rule).
    try { Array.prototype.forEach.call(document.querySelectorAll('.smobnav,.mobnav'), function (n) { n.remove(); }); } catch (e) {}
    try { document.body.appendChild(bottomBar()); } catch (e) {} wire(); }
  var searchEl, scrollEl, _navY = 0;
  function filter(q) {
    q = (q || '').trim().toLowerCase(); if (!scrollEl) return;
    var _cs = scrollEl.querySelector('.mpnav-sub'); if (_cs) _cs.hidden = !q; // searching reveals the calculator sub-items so they can match
    var curSec = null, secHas = false;
    function flush() { if (curSec) curSec.style.display = secHas ? '' : 'none'; }
    Array.prototype.forEach.call(scrollEl.children, function (el) {
      if (el.className === 'mpnav-sec') { flush(); curSec = el; secHas = false; return; }
      var items = el.matches('.mpnav-row,.mpnav-mrow,.mpnav-subrow') ? [el] : Array.prototype.slice.call(el.querySelectorAll('.mpnav-row,.mpnav-mrow,.mpnav-subrow'));
      if (!items.length) return;
      var anyVis = false;
      items.forEach(function (it) { var m = !q || (it.textContent || '').toLowerCase().indexOf(q) >= 0; it.style.display = m ? '' : 'none'; if (m) anyVis = true; });
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
  function renderSugg(q) { var box = document.getElementById('mpnavSugg'); if (!box) return; q = (q || '').trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    if (!SIDX) { loadSidx(function () { renderSugg(q); }); return; }
    var hits = []; for (var i = 0; i < SIDX.length && hits.length < 8; i++) { var x = SIDX[i]; if (x.t.toLowerCase().indexOf(q) >= 0 || x.u.toLowerCase().indexOf(q) >= 0) hits.push(x); }
    if (!hits.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = '<div class="mpnav-sec">'+TR('brPages')+'</div>' + hits.map(function (h) { return '<a class="mpnav-sg" href="' + h.u + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span>' + _esc(h.t) + '</span><small>' + _esc(h.u) + '</small></a>'; }).join('');
    box.hidden = false; }
  function open() { if (searchEl) { searchEl.value = ''; filter(''); } loadSidx(); panel.hidden = false; _navY = window.scrollY || window.pageYOffset || 0; document.documentElement.style.overflow = 'hidden'; document.body.style.position = 'fixed'; document.body.style.top = (-_navY) + 'px'; document.body.style.left = '0'; document.body.style.right = '0'; document.body.style.width = '100%'; requestAnimationFrame(function () { panel.classList.add('open'); if (searchEl) setTimeout(function () { searchEl.focus(); }, 250); }); }
  function close() { panel.classList.remove('open'); document.documentElement.style.overflow = ''; document.body.style.position = ''; document.body.style.top = ''; document.body.style.left = ''; document.body.style.right = ''; document.body.style.width = ''; if (_navY) window.scrollTo(0, _navY); setTimeout(function () { panel.hidden = true; }, 300); }
  try { window.mpNavOpen = open; } catch (e) {}  // let other pages (e.g. Rekt's own nav) open this full, single-source-of-truth Browse drawer
  function wire() {
    searchEl = panel.querySelector('.mpnav-search'); scrollEl = panel.querySelector('.mpnav-scroll');
    btn.addEventListener('click', open);
    // the canonical bar prefers the LIVE in-page feature when the page has it, and falls back to navigation:
    // Browse → the shared drawer (same everywhere) · Practice → in-page Paper-Trade switch on the app shell ·
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
      if (k === 'chat') { var f = document.getElementById('chatFab'); if (f) { e.preventDefault(); f.click(); } return; }
    });
    if (searchEl) searchEl.addEventListener('input', function () { filter(searchEl.value); });
    // expandable Calculators row: toggle its sub-links (button, not a link → doesn't close the drawer)
    panel.addEventListener('click', function (e) { var ex = e.target.closest && e.target.closest('[data-mpexpand]'); if (!ex) return; e.preventDefault(); var key = ex.getAttribute('data-mpexpand'); var sub = panel.querySelector('[data-sub="' + key + '"]'); if (sub) { sub.hidden = !sub.hidden; ex.classList.toggle('open', !sub.hidden); } });
    panel.addEventListener('click', function (e) { var t = e.target; if (t === panel || t.closest('.mpnav-x') || t.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  // Instant navigation: prefetch same-origin pages on hover/pointerdown (Chromium) so the click loads near-instantly;
  // the @view-transition above then cross-fades it. Progressive — unsupported browsers just navigate normally.
  try {
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules') && !document.querySelector('script[type="speculationrules"]')) {
      var sr = document.createElement('script'); sr.type = 'speculationrules';
      sr.textContent = '{"prefetch":[{"source":"document","where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/api/*"}}]},"eagerness":"moderate"}]}';
      document.body.appendChild(sr);
    }
  } catch (_) {}
})();
// Site-wide announcement banner (set in the admin Settings tab): red = severe, orange = blocker, green = fix/small bug.
(function () {
  try {
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
    fetch('/api/symbols').then(function(r){return r.ok?r.json():null;}).then(function(d){
      var syms=(d&&d.symbols)||[];dl.innerHTML=syms.slice(0,400).map(function(s){return '<option value="'+s+'">';}).join('');
    }).catch(function(){});
  }
})();
