// =====================================================================
//  Configuration du salon — partagée par le site et la page admin.
//  Les horaires doivent rester identiques à supabase/schema.sql.
// =====================================================================
window.ELEGANCE = {
  // Supabase > Project Settings > API : « Project URL » et clé « anon public ».
  // Tant que ces deux champs sont vides, le site fonctionne en mode démonstration.
  supabaseUrl: "https://qoigulopadznqcjynoyz.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvaWd1bG9wYWR6bnFjanlub3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMDQ3MTMsImV4cCI6MjEwOTU4MDcxM30.L3Ns_tA0UsrRUNHybQwEgWIuf5ZZLHosSuVi7LP8D_8",

  // Prestations réservables en ligne (la coloration se réserve par téléphone)
  services: [
    { id: "coupe", name: "Coupe homme", price: 18 },
    { id: "coupe-barbe", name: "Coupe & barbe", price: 28 },
    { id: "barbe", name: "Taillage barbe", price: 10 },
    { id: "soin", name: "Soin visage vapeur", price: 25 },
  ],

  // Dernier créneau par jour d'ouverture (0 = dimanche … 6 = samedi)
  open: { 2: "18:30", 3: "18:30", 4: "18:30", 5: "18:30", 6: "18:30" }, // fermeture 19:00
  slots: ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
          "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"], // créneaux de 30 min
  daysAhead: 21, // jours proposés à la réservation
};
