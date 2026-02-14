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

            await client.execute({
                sql: `INSERT INTO users (id, phone_number, country_info) 
                      VALUES (?, ?, ?)
                      ON CONFLICT(id) DO UPDATE SET 
                      phone_number = excluded.phone_number, 
                      country_info = excluded.country_info,
                      updated_at = CURRENT_TIMESTAMP`,
                args: [userId, formatted, countryName],
            });

            return { status: "success", formatted, country: countryName };
        }
        return { status: "fail", message: "Nomor tidak valid" };
    } catch (error) {
        throw error; // Biarkan ditangkap oleh catch di index.js
    }
};

// Arsyilla AI: Pastikan export seperti ini agar bisa di-destructure di index.js
module.exports = { 
    client, 
    saveFormattedPhone 
};
