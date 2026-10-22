// Configuração do Firebase: o mesmo projeto do sistema de torneios (arena-futvolei).
// Os dados do mensal ficam em grupos/{GRUPO}/... e as regras de segurança estão no
// firestore.rules do repositório arena-futvolei (bloco "Mensal de grupos").
// Esses valores não são senhas: a proteção dos dados fica nas regras do Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyC7ikABBgFx4gz4dFFgM-pFufp4m3f1PAQ",
  authDomain: "arena-futvolei.firebaseapp.com",
  projectId: "arena-futvolei",
  storageBucket: "arena-futvolei.firebasestorage.app",
  messagingSenderId: "872948460855",
  appId: "1:872948460855:web:9ff571b48559c8f549beb2"
};

// Identificador do grupo no banco. Para outro grupo, troque aqui.
export const GRUPO = '100compromisso';
