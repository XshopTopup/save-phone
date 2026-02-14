const saveFormattedPhone = async (userId, inputNomor, inputNegara = '') => {
    try {
        const phone = typeof phoneModule === 'function' ? phoneModule : require('phone').phone;
        const result = phone(inputNomor, { country: inputNegara });

        if (result.isValid) {
            const formatted = result.phoneNumber;
            const countryName = result.countryIso3;

            // Arsyilla AI: Menggunakan UPSERT (Insert if not exists, Update if exists)
            await client.execute({
                sql: `INSERT INTO users (id, phone_number, country_info) 
                      VALUES (?, ?, ?)
                      ON CONFLICT(id) DO UPDATE SET 
                      phone_number = excluded.phone_number, 
                      country_info = excluded.country_info,
                      updated_at = CURRENT_TIMESTAMP`,
                args: [userId, formatted, countryName],
            });

            return { status: "success", data: { formatted, country: countryName } };
        }
        return { status: "fail", message: "Nomor tidak valid" };
    } catch (error) {
        return { status: "error", message: error.message };
    }
};
