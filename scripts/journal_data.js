const journalCategories = [
    {
        id: "general",
        name: "General",
        subCategories: [
            {
                id: "general-orthopedics",
                name: "General Orthopedics",
                journals: [
                    { id: "bjj", name: "The Bone & Joint Journal", abbr: "Bone Joint J" },
                    { id: "jbjs-am", name: "The Journal of Bone and Joint Surgery (JBJS Am)", abbr: "J Bone Joint Surg Am" },
                    { id: "corr", name: "Clinical Orthopaedics and Related Research (CORR)", abbr: "Clin Orthop Relat Res" },
                    { id: "acta-orthop", name: "Acta Orthopaedica", abbr: "Acta Orthop" },
                    { id: "jor", name: "Journal of Orthopaedic Research (JOR)", abbr: "J Orthop Res" },
                    { id: "int-orthop", name: "International Orthopaedics", abbr: "Int Orthop" },
                    { id: "bmc-msk", name: "BMC Musculoskeletal Disorders", abbr: "BMC Musculoskelet Disord" },
                    { id: "josr", name: "Journal of Orthopaedic Surgery and Research (JOSR)", abbr: "J Orthop Surg Res" },
                    { id: "aots", name: "Archives of Orthopaedic and Trauma Surgery", abbr: "Arch Orthop Trauma Surg" },
                    { id: "jaaos", name: "Journal of the American Academy of Orthopaedic Surgeons (JAAOS)", abbr: "J Am Acad Orthop Surg" },
                    { id: "jos-japan", name: "Journal of Orthopaedic Science", abbr: "J Orthop Sci" },
                    { id: "injury-general", name: "Injury (International Journal of the Care of the Injured)", abbr: "Injury" },
                    { id: "efort-open-rev", name: "EFORT Open Reviews", abbr: "EFORT Open Rev" },
                    { id: "orthop-traumatol-surg-res", name: "Orthopaedics & Traumatology: Surgery & Research", abbr: "Orthop Traumatol Surg Res" },
                    { id: "j-orthop-translat", name: "Journal of Orthopaedic Translation", abbr: "J Orthop Translat" },
                    { id: "j-orthop", name: "Journal of Orthopaedics", abbr: "J Orthop" },
                    { id: "j-orthop-traumatol", name: "Journal of Orthopaedics and Traumatology", abbr: "J Orthop Traumatol" },
                    { id: "orthop-surg", name: "Orthopaedic Surgery", abbr: "Orthop Surg" },
                    { id: "clin-orthop-surg", name: "Clinics in Orthopedic Surgery", abbr: "Clin Orthop Surg" },
                    { id: "orthopedics", name: "Orthopedics", abbr: "Orthopedics" },
                    { id: "hss-j", name: "HSS Journal", abbr: "HSS J" },
                    { id: "indian-j-orthop", name: "Indian Journal of Orthopaedics", abbr: "Indian J Orthop" },
                    { id: "acta-orthop-traumatol-turc", name: "Acta Orthopaedica et Traumatologica Turcica", abbr: "Acta Orthop Traumatol Turc" },
                    { id: "acta-ortop-bras", name: "Acta Ortopedica Brasileira", abbr: "Acta Ortop Bras" },
                    { id: "oper-orthop-traumatol", name: "Operative Orthopadie und Traumatologie", abbr: "Oper Orthop Traumatol" },
                    { id: "z-orthop-unfall", name: "Zeitschrift fur Orthopadie und Unfallchirurgie", abbr: "Z Orthop Unfall" },
                    { id: "orthop-clin-north-am", name: "Orthopedic Clinics of North America", abbr: "Orthop Clin North Am" }
                ]
            },
            {
                id: "bone-cartilage-research",
                name: "Bone, Cartilage & Orthopaedic Research",
                journals: [
                    { id: "osteoarthritis-cartilage", name: "Osteoarthritis and Cartilage", abbr: "Osteoarthritis Cartilage" },
                    { id: "bone-joint-res", name: "Bone & Joint Research", abbr: "Bone Joint Res" },
                    { id: "archives-osteoporosis", name: "Archives of Osteoporosis", abbr: "Arch Osteoporos" },
                    { id: "connect-tissue-res", name: "Connective Tissue Research", abbr: "Connect Tissue Res" },
                    { id: "gait-posture", name: "Gait & Posture", abbr: "Gait Posture" }
                ]
            },
            {
                id: "rehab-biomechanics-orthotics",
                name: "Rehabilitation, Biomechanics & Orthotics",
                journals: [
                    { id: "j-physiother", name: "Journal of Physiotherapy", abbr: "J Physiother" },
                    { id: "jospt", name: "Journal of Orthopaedic & Sports Physical Therapy", abbr: "J Orthop Sports Phys Ther" },
                    { id: "physical-therapy", name: "Physical Therapy", abbr: "Phys Ther" },
                    { id: "braz-j-phys-ther", name: "Brazilian Journal of Physical Therapy", abbr: "Braz J Phys Ther" },
                    { id: "clin-biomech", name: "Clinical Biomechanics", abbr: "Clin Biomech (Bristol, Avon)", pubmedTerms: ["Clinical biomechanics (Bristol, Avon)"] },
                    { id: "prosthet-orthot-int", name: "Prosthetics and Orthotics International", abbr: "Prosthet Orthot Int" },
                    { id: "orthop-nurs", name: "Orthopaedic Nursing", abbr: "Orthop Nurs" }
                ]
            },
            {
                id: "imaging",
                name: "Musculoskeletal Imaging",
                journals: [
                    { id: "skeletal-radiol", name: "Skeletal Radiology", abbr: "Skeletal Radiol" }
                ]
            }
        ]
    },
    {
        id: "specific",
        name: "Specific",
        subCategories: [
            {
                id: "arthroplasty",
                name: "Arthroplasty / Joint Replacement",
                journals: [
                    { id: "j-arthroplasty", name: "The Journal of Arthroplasty", abbr: "J Arthroplasty" },
                    { id: "hip-int", name: "Hip International", abbr: "Hip Int" },
                    { id: "arthroplasty", name: "Arthroplasty", abbr: "Arthroplasty" },
                    { id: "j-orthop-surg-hk", name: "Journal of Orthopaedic Surgery (JOS)", abbr: "J Orthop Surg (Hong Kong)" },
                    { id: "j-hip-preserv-surg", name: "Journal of Hip Preservation Surgery", abbr: "J Hip Preserv Surg" }
                ]
            },
            {
                id: "shoulder-elbow",
                name: "Shoulder & Elbow",
                journals: [
                    { id: "jses", name: "Journal of Shoulder and Elbow Surgery (JSES)", abbr: "J Shoulder Elbow Surg", pubmedTerms: ["J Shoulder Elbow Surg", "Journal of Shoulder and Elbow Surgery"] },
                    { id: "shoulder-elbow", name: "Shoulder & Elbow", abbr: "Shoulder Elbow", pubmedTerms: ["Shoulder Elbow", "Shoulder & Elbow"] },
                    { id: "int-j-shoulder-surg", name: "International Journal of Shoulder Surgery", abbr: "Int J Shoulder Surg", pubmedTerms: ["Int J Shoulder Surg", "International Journal of Shoulder Surgery"] }
                ]
            },
            {
                id: "spine",
                name: "Spine",
                journals: [
                    { id: "spine-phila", name: "Spine", abbr: "Spine (Phila Pa 1976)" },
                    { id: "eur-spine-j", name: "European Spine Journal", abbr: "Eur Spine J" },
                    { id: "spine-j", name: "The Spine Journal", abbr: "Spine J" },
                    { id: "j-neurosurg-spine", name: "Journal of Neurosurgery: Spine", abbr: "J Neurosurg Spine" },
                    { id: "global-spine-j", name: "Global Spine Journal", abbr: "Global Spine J" },
                    { id: "spine-surg-relat-res", name: "Spine Surgery and Related Research", abbr: "Spine Surg Relat Res" },
                    { id: "jor-spine", name: "JOR Spine", abbr: "JOR Spine" },
                    { id: "clin-spine-surg", name: "Clinical Spine Surgery", abbr: "Clin Spine Surg" },
                    { id: "j-back-msk-rehabil", name: "Journal of Back and Musculoskeletal Rehabilitation", abbr: "J Back Musculoskelet Rehabil" }
                ]
            },
            {
                id: "sports-arthroscopy",
                name: "Sports Medicine & Arthroscopy",
                journals: [
                    { id: "ajsm", name: "The American Journal of Sports Medicine (AJSM)", abbr: "Am J Sports Med" },
                    { id: "arthroscopy-journal", name: "Arthroscopy: The Journal of Arthroscopic & Related Surgery", abbr: "Arthroscopy" },
                    { id: "kssta", name: "Knee Surgery, Sports Traumatology, Arthroscopy (KSSTA)", abbr: "Knee Surg Sports Traumatol Arthrosc" },
                    { id: "ojsm", name: "Orthopaedic Journal of Sports Medicine (OJSM)", abbr: "Orthop J Sports Med" },
                    { id: "j-isakos", name: "Journal of ISAKOS (Joint Diseases & Sports Orthopaedics)", abbr: "J ISAKOS" },
                    { id: "clin-j-sport-med", name: "Clinical Journal of Sport Medicine", abbr: "Clin J Sport Med" },
                    { id: "phys-sportsmed", name: "The Physician and Sportsmedicine", abbr: "Phys Sportsmed" },
                    { id: "sportverletz-sportschaden", name: "Sportverletzung Sportschaden", abbr: "Sportverletz Sportschaden" },
                    { id: "isokinet-exerc-sci", name: "Isokinetics and Exercise Science", abbr: "Isokinet Exerc Sci" }
                ]
            },
            {
                id: "trauma",
                name: "Orthopaedic Trauma",
                journals: [
                    { id: "j-orthop-trauma", name: "Journal of Orthopaedic Trauma (JOT)", abbr: "J Orthop Trauma" },
                    { id: "j-trauma-acute-care-surg", name: "Journal of Trauma and Acute Care Surgery", abbr: "J Trauma Acute Care Surg" },
                    { id: "injury-trauma", name: "Injury: International Journal of the Care of the Injured", abbr: "Injury" },
                    { id: "strategies-trauma-limb-reconstr", name: "Strategies in Trauma and Limb Reconstruction", abbr: "Strategies Trauma Limb Reconstr" }
                ]
            },
            {
                id: "foot-ankle",
                name: "Foot & Ankle",
                journals: [
                    { id: "foot-ankle-int", name: "Foot & Ankle International", abbr: "Foot Ankle Int" },
                    { id: "foot-ankle-surg", name: "Foot and Ankle Surgery", abbr: "Foot Ankle Surg" },
                    { id: "j-foot-ankle-res", name: "Journal of Foot and Ankle Research", abbr: "J Foot Ankle Res" },
                    { id: "j-foot-ankle-surg", name: "The Journal of Foot and Ankle Surgery", abbr: "J Foot Ankle Surg" },
                    { id: "foot-ankle-clin", name: "Foot and Ankle Clinics", abbr: "Foot Ankle Clin" },
                    { id: "clin-podiatr-med-surg", name: "Clinics in Podiatric Medicine and Surgery", abbr: "Clin Podiatr Med Surg" },
                    { id: "j-am-podiatr-med-assoc", name: "Journal of the American Podiatric Medical Association", abbr: "J Am Podiatr Med Assoc" }
                ]
            },
            {
                id: "hand-upper-extremity",
                name: "Hand & Upper Extremity",
                journals: [
                    { id: "j-hand-surg-am", name: "The Journal of Hand Surgery (American Volume)", abbr: "J Hand Surg Am" },
                    { id: "j-hand-surg-eur", name: "Journal of Hand Surgery (European Volume)", abbr: "J Hand Surg Eur Vol" },
                    { id: "hand-clin", name: "Hand Clinics", abbr: "Hand Clin" },
                    { id: "hand-surg-rehabil", name: "Hand Surgery & Rehabilitation", abbr: "Hand Surg Rehabil" },
                    { id: "j-hand-ther", name: "Journal of Hand Therapy", abbr: "J Hand Ther" },
                    { id: "j-plast-surg-hand-surg", name: "Journal of Plastic Surgery and Hand Surgery", abbr: "J Plast Surg Hand Surg" }
                ]
            },
            {
                id: "knee",
                name: "Knee",
                journals: [
                    { id: "knee", name: "The Knee", abbr: "Knee" },
                    { id: "j-knee-surg", name: "Journal of Knee Surgery", abbr: "J Knee Surg" },
                    { id: "cartilage", name: "Cartilage", abbr: "Cartilage" }
                ]
            },
            {
                id: "pediatric",
                name: "Pediatric Orthopedics",
                journals: [
                    { id: "j-child-orthop", name: "Journal of Children's Orthopaedics", abbr: "J Child Orthop" },
                    { id: "j-pediatr-orthop", name: "Journal of Pediatric Orthopaedics", abbr: "J Pediatr Orthop" },
                    { id: "j-pediatr-orthop-b", name: "Journal of Pediatric Orthopaedics Part B", abbr: "J Pediatr Orthop B" }
                ]
            }
        ]
    }
];

export { journalCategories };
