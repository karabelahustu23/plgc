import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: { translation: {
    "nav.store": "Store", "nav.myEsims": "My eSIMs", "nav.family": "Family", "nav.wallet": "Wallet", "nav.support": "Support",
    "store.title": "Find your eSIM", "store.subtitle": "Instant connectivity in 200+ countries",
    "wallet.balance": "Wallet Balance", "wallet.topup": "Top Up", "wallet.transactions": "Transactions",
    "family.title": "Family Members", "family.add": "Add Member", "family.esims": "eSIMs",
    "auth.login": "Sign In", "auth.signup": "Create Account", "auth.google": "Continue with Google",
    "auth.email": "Email", "auth.password": "Password", "auth.name": "Full Name",
    "common.buy": "Buy eSIM", "common.back": "Back", "common.save": "Save", "common.cancel": "Cancel",
    "referral.title": "Refer & Earn", "referral.desc": "Earn $2 for every $20 your referral adds to their wallet",
    "redeem.title": "Redeem Code", "redeem.apply": "Apply Code",
    "support.title": "Support", "support.newTicket": "New Ticket",
    "admin.title": "Admin Panel", "admin.markup": "Price Markup", "admin.users": "Users", "admin.settings": "Site Settings",
  }},
  tr: { translation: {
    "nav.store": "Mağaza", "nav.myEsims": "eSIM'lerim", "nav.family": "Aile", "nav.wallet": "Cüzdan", "nav.support": "Destek",
    "store.title": "eSIM'inizi bulun", "store.subtitle": "200'den fazla ülkede anında bağlantı",
    "wallet.balance": "Cüzdan Bakiyesi", "wallet.topup": "Para Yükle", "wallet.transactions": "İşlemler",
    "family.title": "Aile Üyeleri", "family.add": "Üye Ekle", "family.esims": "eSIM'ler",
    "auth.login": "Giriş Yap", "auth.signup": "Hesap Oluştur", "auth.google": "Google ile Devam Et",
    "auth.email": "E-posta", "auth.password": "Şifre", "auth.name": "Ad Soyad",
    "common.buy": "eSIM Satın Al", "common.back": "Geri", "common.save": "Kaydet", "common.cancel": "İptal",
    "referral.title": "Davet Et & Kazan", "referral.desc": "Davet ettiğin kişi 20$ yüklediğinde 2$ kazan",
    "redeem.title": "Kodu Kullan", "redeem.apply": "Kodu Uygula",
    "support.title": "Destek", "support.newTicket": "Yeni Talep",
    "admin.title": "Admin Paneli", "admin.markup": "Fiyat Kârı", "admin.users": "Kullanıcılar", "admin.settings": "Site Ayarları",
  }},
  de: { translation: {
    "nav.store": "Shop", "nav.myEsims": "Meine eSIMs", "nav.family": "Familie", "nav.wallet": "Geldbörse", "nav.support": "Support",
    "store.title": "Ihre eSIM finden", "store.subtitle": "Sofortige Verbindung in 200+ Ländern",
    "wallet.balance": "Guthaben", "wallet.topup": "Aufladen", "wallet.transactions": "Transaktionen",
    "auth.login": "Anmelden", "auth.signup": "Konto erstellen", "auth.google": "Mit Google fortfahren",
    "common.buy": "eSIM kaufen",
  }},
  fr: { translation: {
    "nav.store": "Boutique", "nav.myEsims": "Mes eSIMs", "nav.family": "Famille", "nav.wallet": "Portefeuille", "nav.support": "Support",
    "store.title": "Trouvez votre eSIM", "store.subtitle": "Connectivité instantanée dans 200+ pays",
    "wallet.balance": "Solde", "wallet.topup": "Recharger", "wallet.transactions": "Transactions",
    "auth.login": "Se connecter", "auth.signup": "Créer un compte", "auth.google": "Continuer avec Google",
    "common.buy": "Acheter eSIM",
  }},
  ar: { translation: {
    "nav.store": "المتجر", "nav.myEsims": "شرائحي", "nav.family": "العائلة", "nav.wallet": "المحفظة", "nav.support": "الدعم",
    "store.title": "ابحث عن شريحتك", "store.subtitle": "اتصال فوري في 200+ دولة",
    "auth.login": "تسجيل الدخول", "auth.signup": "إنشاء حساب",
    "common.buy": "شراء eSIM",
  }},
  zh: { translation: {
    "nav.store": "商店", "nav.myEsims": "我的eSIM", "nav.family": "家庭", "nav.wallet": "钱包", "nav.support": "支持",
    "store.title": "找到您的eSIM", "store.subtitle": "即时连接200多个国家",
    "auth.login": "登录", "auth.signup": "创建账户",
    "common.buy": "购买eSIM",
  }},
  es: { translation: {
    "nav.store": "Tienda", "nav.myEsims": "Mis eSIMs", "nav.family": "Familia", "nav.wallet": "Cartera", "nav.support": "Soporte",
    "store.title": "Encuentra tu eSIM", "store.subtitle": "Conectividad instantánea en 200+ países",
    "auth.login": "Iniciar sesión", "auth.signup": "Crear cuenta",
    "common.buy": "Comprar eSIM",
  }},
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
