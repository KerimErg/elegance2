// =====================================================================
//  Configuration du salon — partagée par le site et la page admin.
//  Les horaires doivent rester identiques à supabase/schema.sql.
// =====================================================================
window.ELEGANCE = {
  // Supabase > Project Settings > API : « Project URL » et clé « anon public ».
  // Tant que ces deux champs sont vides, le site fonctionne en mode démonstration.
  supabaseUrl: "https://qoigulopadznqcjynoyz.supabase.co",
  supabaseAnonKey: "",

  services: [
    { id: "coupe", name: "Coupe", price: 25 },
    { id: "degrade", name: "Dégradé", price: 25 },
    { id: "cb", name: "Coupe + barbe", price: 35 },
    { id: "barbe", name: "Barbe", price: 15 },
    { id: "deco", name: "Décoloration", price: 50 },
    { id: "enfant", name: "Enfant", price: 18 },
  ],

  // Dernier créneau par jour d'ouverture (0 = dimanche … 6 = samedi)
  open: { 2: "18:00", 3: "18:00", 4: "18:00", 5: "18:00", 6: "17:00" },
  slots: ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
  daysAhead: 21, // jours proposés à la réservation
};
