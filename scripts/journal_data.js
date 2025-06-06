const journalCategories = [
    {
        id: "general",
        name: "General Orthopedics",
        journals: [
            { id: "bjj", name: "Bone Joint J" },
            { id: "corr", name: "Clin Orthop Relat Res" },
            { id: "ao", name: "Acta Orthop" },
            { id: "jor", name: "J Orthop Res" },
            { id: "io", name: "Int Orthop" },
            { id: "bmc", name: "BMC Musculoskelet Disord" },
            { id: "josr", name: "J Orthop Surg Res" },
            { id: "aots", name: "Arch Orthop Trauma Surg" },
            { id: "otsr", name: "Orthop Traumatol Surg Res" },
            { id: "eor", name: "EFORT Open Rev" }
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
                    { id: "kssta", name: "Knee Surg Sports Traumatol Arthrosc" },
                    { id: "arthroscopy", name: "Arthroscopy" },
                    { id: "ojsm", name: "Orthop J Sports Med" }
                ]
            },
            {
                id: "trauma",
                name: "Trauma",
                journals: [
                    { id: "jot-trauma", name: "J Orthop Trauma" },
                    { id: "injury", name: "Injury" }
                ]
            },
            {
                id: "arthroplasty",
                name: "Arthroplasty / Joint Replacement",
                journals: [
                    { id: "joa", name: "J Arthroplasty" },
                    { id: "hip-int", name: "Hip Int" }
                ]
            },
            {
                id: "shoulder",
                name: "Shoulder & Elbow",
                journals: [
                    { id: "jse", name: "J Shoulder Elbow Surg" }
                ]
            },
            {
                id: "spine",
                name: "Spine",
                journals: [
                    { id: "spine", name: "Spine (Phila Pa 1976)" },
                    { id: "ejss", name: "Eur Spine J" },
                    { id: "spj", name: "Spine J" },
                    { id: "spine-phila", name: "Spine (Phila Pa 1976)" },
                    { id: "gsj", name: "Global Spine J" }
                ]
            },
            {
                id: "foot",
                name: "Foot & Ankle",
                journals: [
                    { id: "fai", name: "Foot Ankle Int" },
                    { id: "fas", name: "Foot Ankle Surg" }
                ]
            },
            {
                id: "pediatric",
                name: "Pediatric Orthopedics",
                journals: [
                    { id: "jpo", name: "J Pediatr Orthop" }
                ]
            },
            {
                id: "hand",
                name: "Hand Surgery",
                journals: [
                    { id: "jhsa", name: "J Hand Surg Am" },
                    { id: "jhse", name: "J Hand Surg Eur Vol" }
                ]
            },
            {
                id: "bone",
                name: "Osteoporosis & Bone Metabolism",
                journals: [
                    { id: "oac", name: "Osteoarthritis Cartilage" },
                    { id: "ao-osteo", name: "Arch Osteoporos" },
                    { id: "bjr", name: "Bone Joint Res" }
                ]
            }
        ]
    }
];

export { journalCategories };
