package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestTrustedRealIP(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("::1/128")}

	cases := []struct {
		name       string
		remoteAddr string
		realIP     []string
		xff        string
		want       string
	}{
		{"cliente directo que falsea X-Real-IP", "203.0.113.5:4000", []string{"1.2.3.4"}, "", "203.0.113.5:4000"},
		{"cliente directo que falsea X-Forwarded-For", "203.0.113.5:4000", nil, "1.2.3.4", "203.0.113.5:4000"},
		{"nginx local con X-Real-IP", "127.0.0.1:5000", []string{"198.51.100.7"}, "", "198.51.100.7:0"},
		{"nginx local por IPv6", "[::1]:5000", []string{"2001:db8::1"}, "", "[2001:db8::1]:0"},
		{"X-Real-IP repetida: gana la última", "127.0.0.1:5000", []string{"1.2.3.4", "198.51.100.7"}, "", "198.51.100.7:0"},
		{"proxy sin X-Real-IP: se queda la del proxy", "127.0.0.1:5000", nil, "1.2.3.4", "127.0.0.1:5000"},
		{"X-Real-IP inválida: se queda la del proxy", "127.0.0.1:5000", []string{"basura"}, "", "127.0.0.1:5000"},
		{"IPv4 mapeada en IPv6", "127.0.0.1:5000", []string{"::ffff:198.51.100.7"}, "", "198.51.100.7:0"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = c.remoteAddr
			for _, v := range c.realIP {
				req.Header.Add("X-Real-IP", v)
			}
			if c.xff != "" {
				req.Header.Set("X-Forwarded-For", c.xff)
			}
			var got string
			TrustedRealIP(trusted)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				got = r.RemoteAddr
			})).ServeHTTP(httptest.NewRecorder(), req)
			if got != c.want {
				t.Errorf("RemoteAddr = %q, se esperaba %q", got, c.want)
			}
		})
	}
}
