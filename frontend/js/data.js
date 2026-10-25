// Sample hospital data for the prototype. Replace with the hospital's real departments,
// rooms and duty roster before use. Each department's `code` is the letter its tokens carry.
window.CAREQUEUE_DATA = {
  hospital: { name: "CareQueue", desk: "Main reception" },
  departments: [
    { id: "gen",   code: "G", name: "General Medicine", location: "Ground floor, Block A",
      doctors: ["Dr. Anjali Rao", "Dr. Vikram Menon"] },
    { id: "card",  code: "C", name: "Cardiology",       location: "First floor, Block B",
      doctors: ["Dr. Suresh Iyer", "Dr. Meera Krishnan"] },
    { id: "ortho", code: "O", name: "Orthopaedics",     location: "First floor, Block A",
      doctors: ["Dr. Arjun Nair", "Dr. Kavya Reddy"] },
    { id: "paed",  code: "P", name: "Paediatrics",      location: "Ground floor, Block C",
      doctors: ["Dr. Lakshmi Prasad", "Dr. Rahul Varma"] },
    { id: "derm",  code: "D", name: "Dermatology",      location: "Second floor, Block B",
      doctors: ["Dr. Farah Siddiqui"] },
    { id: "ent",   code: "E", name: "ENT",              location: "Second floor, Block A",
      doctors: ["Dr. Naveen Kumar", "Dr. Divya Shankar"] },
    // Billing is a queue of its own (US-04): staff send patients here after their visit, or patients join directly.
    { id: "bill",  code: "B", name: "Billing",          location: "Ground floor, Main reception",
      doctors: [], billing: true }
  ],
  // Shown only in the "Sample" state, before a visitor generates a token.
  sampleToken: {
    number: "G023", departmentId: "gen", doctor: "Dr. Anjali Rao",
    patient: "Sample patient", issued: "24 Oct 2026, 10:30 AM", wait: "20–30 min"
  }
};
