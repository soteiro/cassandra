package middleware

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// TrustedRealIP reemplaza a chi's RealIP, que aceptaba X-Forwarded-For/X-Real-IP de
// cualquiera (un cliente podía falsearlas para saltarse el límite de peticiones).
//
// Solo cuando la conexión llega desde un proxy de confianza (p. ej. nginx en
// localhost) se toma la IP de X-Real-IP, que ese proxy fija en cada petición. En otro
// caso se usa la dirección de la conexión. Fija r.RemoteAddr, que usan el rate limit
// por IP y el log de peticiones.
func TrustedRealIP(trusted []netip.Prefix) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if peer, ok := addrOf(r.RemoteAddr); ok && inPrefixes(peer, trusted) {
				if ip, ok := parseIP(lastValue(r.Header.Values("X-Real-Ip"))); ok {
					r.RemoteAddr = net.JoinHostPort(ip.String(), "0")
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func addrOf(remoteAddr string) (netip.Addr, bool) {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return parseIP(host)
}

func parseIP(s string) (netip.Addr, bool) {
	ip, err := netip.ParseAddr(strings.TrimSpace(s))
	if err != nil {
		return netip.Addr{}, false
	}
	return ip.Unmap().WithZone(""), true
}

func inPrefixes(ip netip.Addr, prefixes []netip.Prefix) bool {
	for _, p := range prefixes {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}

// lastValue: si la cabecera llega repetida gana la última, la que puso el proxy más cercano.
func lastValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[len(values)-1]
}
