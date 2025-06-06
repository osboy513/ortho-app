const journalCategories = [
    {
        id: "general",
        name: "General Orthopedics",
        journals: [
            { id: "bjj", name: "The Bone & Joint Journal" },
            { id: "corr", name: "Clinical Orthopaedics and Related Research" },
            { id: "ao", name: "Acta Orthopaedica" },
            { id: "jor", name: "Journal of Orthopaedic Research" },
            { id: "io", name: "International Orthopaedics" },
            { id: "bmc", name: "BMC Musculoskeletal Disorders" },
            { id: "josr", name: "Journal of Orthopaedic Surgery and Research" },
            { id: "aots", name: "Archives of Orthopaedic and Trauma Surgery" },
            { id: "otsr", name: "Orthopaedics & Traumatology: Surgery & Research" },
            { id: "eor", name: "EFORT Open Reviews" }
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
                    { id: "kssta", name: "Knee Surgery, Sports Traumatology, Arthroscopy" },
                    { id: "arthroscopy", name: "Arthroscopy: The Journal of Arthroscopic and Related Surgery" },
                    { id: "ojsm", name: "Orthopaedic Journal of Sports Medicine" }
                ]
            },
            {
                id: "trauma",
                name: "Trauma",
                journals: [
                    { id: "jot-trauma", name: "Journal of Orthopaedic Trauma" },
                    { id: "injury", name: "Injury" }
                ]
            },
            {
                id: "arthroplasty",
                name: "Arthroplasty / Joint Replacement",
                journals: [
                    { id: "joa", name: "Journal of Arthroplasty" },
                    { id: "hip-int", name: "Hip International" }
                ]
            },
            {
                id: "shoulder",
                name: "Shoulder & Elbow",
                journals: [
                    { id: "jse", name: "Journal of Shoulder and Elbow Surgery" }
                ]
            },
            {
                id: "spine",
                name: "Spine",
                journals: [
                    { id: "spine", name: "Spine" },
                    { id: "ejss", name: "European Spine Journal" },
                    { id: "spj", name: "The Spine Journal" },
                    { id: "spine-phila", name: "Spine (Phila Pa 1976)" },
                    { id: "gsj", name: "Global Spine Journal" }
                ]
            },
            {
                id: "foot",
                name: "Foot & Ankle",
                journals: [
                    { id: "fai", name: "Foot & Ankle International" },
                    { id: "fas", name: "Foot and Ankle Surgery" }
                ]
            },
            {
                id: "pediatric",
                name: "Pediatric Orthopedics",
                journals: [
                    { id: "jpo", name: "Pediatric Orthopaedic Society of North America" }
                ]
            },
            {
                id: "hand",
                name: "Hand Surgery",
                journals: [
                    { id: "jhsa", name: "Journal of Hand Surgery, American Volume" },
                    { id: "jhse", name: "Journal of Hand Surgery, European Volume" }
                ]
            },
            {
                id: "bone",
                name: "Osteoporosis & Bone Metabolism",
                journals: [
                    { id: "oac", name: "Osteoarthritis and Cartilage" },
                    { id: "ao", name: "Archives of Osteoporosis" },
                    { id: "bjr", name: "Bone & Joint Research" }
                ]
            }
        ]
    }
];

export { journalCategories };
