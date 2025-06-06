const journalCategories = [
    {
        id: "general",
        name: "General Orthopedics",
        journals: [
            { id: "bjj", name: "The Bone & Joint Journal", abbr: "Bone Joint J" },
            { id: "corr", name: "Clinical Orthopaedics and Related Research", abbr: "Clin Orthop Relat Res" },
            { id: "ao", name: "Acta Orthopaedica", abbr: "Acta Orthop" },
            { id: "jor", name: "Journal of Orthopaedic Research", abbr: "J Orthop Res" },
            { id: "io", name: "International Orthopaedics", abbr: "Int Orthop" },
            { id: "bmc", name: "BMC Musculoskeletal Disorders", abbr: "BMC Musculoskelet Disord" },
            { id: "josr", name: "Journal of Orthopaedic Surgery and Research", abbr: "J Orthop Surg Res" },
            { id: "aots", name: "Archives of Orthopaedic and Trauma Surgery", abbr: "Arch Orthop Trauma Surg" },
            { id: "otsr", name: "Orthopaedics & Traumatology, Surgery & Research", abbr: "Orthop Traumatol Surg Res" },
            { id: "eor", name: "EFORT Open Reviews", abbr: "EFORT Open Rev" }
        ]
    },
    {
        id: "specialized",
        name: "Specialized Areas",
        subCategories: [
            {
                id: "sports",
                name: "Sports Medicine",
                journals: [
                    { id: "kssta", name: "Knee Surgery, Sports Traumatology, Arthroscopy", abbr: "Knee Surg Sports Traumatol Arthrosc" },
                    { id: "arthroscopy", name: "Arthroscopy: The Journal of Arthroscopic and Related Surgery", abbr: "Arthroscopy" },
                    { id: "ojsm", name: "Orthopaedic Journal of Sports Medicine", abbr: "Orthop J Sports Med" }
                ]
            },
            {
                id: "trauma",
                name: "Trauma",
                journals: [
                    { id: "jot-trauma", name: "Journal of Orthopaedic Trauma", abbr: "J Orthop Trauma" },
                    { id: "injury", name: "Injury", abbr: "Injury" }
                ]
            },
            {
                id: "arthroplasty",
                name: "Arthroplasty / Joint Replacement",
                journals: [
                    { id: "joa", name: "The Journal of Arthroplasty", abbr: "J Arthroplasty" },
                    { id: "hip-int", name: "Hip International", abbr: "Hip Int" }
                ]
            },
            {
                id: "shoulder",
                name: "Shoulder & Elbow",
                journals: [
                    { id: "jse", name: "Journal of Shoulder and Elbow Surgery", abbr: "J Shoulder Elbow Surg" }
                ]
            },
            {
                id: "spine",
                name: "Spine",
                journals: [
                    { id: "spine", name: "Spine", abbr: "Spine (Phila Pa 1976)" },
                    { id: "ejss", name: "European Spine Journal", abbr: "Eur Spine J" },
                    { id: "spj", name: "The Spine Journal", abbr: "Spine J" },
                    { id: "spine-phila", name: "Spine", abbr: "Spine (Phila Pa 1976)" },
                    { id: "gsj", name: "Global Spine Journal", abbr: "Global Spine J" }
                ]
            },
            {
                id: "foot",
                name: "Foot & Ankle",
                journals: [
                    { id: "fai", name: "Foot & Ankle International", abbr: "Foot Ankle Int" },
                    { id: "fas", name: "Foot and Ankle Surgery", abbr: "Foot Ankle Surg" }
                ]
            },
            {
                id: "pediatric",
                name: "Pediatric Orthopedics",
                journals: [
                    { id: "jpo", name: "Journal of Pediatric Orthopaedics", abbr: "J Pediatr Orthop" }
                ]
            },
            {
                id: "hand",
                name: "Hand Surgery",
                journals: [
                    { id: "jhsa", name: "The Journal of Hand Surgery", abbr: "J Hand Surg Am" },
                    { id: "jhse", name: "Journal of Hand Surgery (European Volume)", abbr: "J Hand Surg Eur Vol" }
                ]
            },
            {
                id: "bone",
                name: "Osteoporosis & Bone Metabolism",
                journals: [
                    { id: "oac", name: "Osteoarthritis and Cartilage", abbr: "Osteoarthritis Cartilage" },
                    { id: "ao-osteo", name: "Archives of Osteoporosis", abbr: "Arch Osteoporos" },
                    { id: "bjr", name: "Bone & Joint Research", abbr: "Bone Joint Res" }
                ]
            }
        ]
    }
];

export { journalCategories };
