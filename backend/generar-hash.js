const bcrypt = require('bcrypt');

const password = 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Contraseña:', password);
        console.log('Hash generado:', hash);
        console.log('\n📝 Copia este hash y actualiza la tabla:');
        console.log(`UPDATE usuarios SET password_hash = '${hash}' WHERE username = 'admin';`);
    }
});