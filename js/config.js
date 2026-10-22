// Configuração do Firebase do projeto exclusivo do mensal (mensal-100compromisso).
// Os dados ficam em grupos/{GRUPO}/... e as regras de segurança em firestore.rules
// (publique em Console do Firebase › Firestore › Regras › Publicar).
// Esses valores não são senhas: a proteção dos dados fica nas regras do Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyBF5YQyzjWDOuAELm62lTxQgApPJoEjl0o",
  authDomain: "mensal-100compromisso.firebaseapp.com",
  projectId: "mensal-100compromisso",
  storageBucket: "mensal-100compromisso.firebasestorage.app",
  messagingSenderId: "50380576479",
  appId: "1:50380576479:web:54246954b5b1f1a070bb6a"
};

// Identificador do grupo no banco. Para outro grupo, troque aqui.
export const GRUPO = '100compromisso';
