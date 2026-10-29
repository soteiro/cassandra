package ticktick

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"strconv"
)

type Cipher struct{ aead cipher.AEAD }

func NewCipher(key []byte) (*Cipher, error) {
	if len(key) != 32 {
		return nil, errors.New("la clave de integraciones debe tener 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Cipher{aead}, nil
}

func (c *Cipher) Encrypt(userID int, token string) ([]byte, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return c.aead.Seal(nonce, nonce, []byte(token), []byte("ticktick:"+strconv.Itoa(userID))), nil
}

func (c *Cipher) Decrypt(userID int, value []byte) (string, error) {
	if len(value) < c.aead.NonceSize()+c.aead.Overhead() {
		return "", errors.New("credencial de integración inválida")
	}
	plain, err := c.aead.Open(nil, value[:c.aead.NonceSize()], value[c.aead.NonceSize():], []byte("ticktick:"+strconv.Itoa(userID)))
	if err != nil {
		return "", errors.New("no se pudo abrir la credencial de integración")
	}
	return string(plain), nil
}
