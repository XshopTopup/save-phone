const { phone: phoneModule } = require('phone');
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const saveFormattedPhone = async (userId, inputNomor, inputNegara = '') => {
    try {
        const phone = typeof phoneModule === 'function' ? phoneModule : require('phone').phone;
        const result = phone(inputNomor, { country: inputNegara });

        if (result.isValid) {
            const formatted = result.phoneNumber;
            const countryName = result.countryIso3;
            const countryCode = result.countryCode;

            await client.execute({
                sql: "UPDATE users SET phone_number = ?, country_info = ? WHERE id = ?",
                args: [formatted, countryName, userId],
            });

            return { 
                status: "success", 
                data: {
                    formatted: formatted,
                    detectedCountry: {
                        iso3: countryName,
                        dialCode: countryCode,
                        isInternational: inputNomor.startsWith('+')
                    }
                }
            };
        }

        return { 
            status: "fail", 
            message: "Nomor tidak valid untuk negara yang ditentukan atau format salah" 
        };

    } catch (error) {
        console.error("Error pada phoneHelper (Turso):", error.message);
        return { 
            status: "error", 
            message: error.message 
        };
    }
};

module.exports = { saveFormattedPhone, client };
