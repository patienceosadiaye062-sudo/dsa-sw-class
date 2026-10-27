function routeSegments(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw new TypeError('Route paths must be absolute paths without a query or fragment.');
  }
  if (path === '/') return [];
  return path.slice(1).replace(/\/$/, '').split('/');
}

export function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    if (typeof method !== 'string' || !method.trim()) throw new TypeError('A route method is required.');
    if (typeof handler !== 'function') throw new TypeError('A route handler must be a function.');

    const segments = routeSegments(path);
    const names = segments.filter(segment => segment.startsWith(':')).map(segment => segment.slice(1));
    if (names.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
      throw new TypeError('Route parameters must have a valid name.');
    }
    if (new Set(names).size !== names.length) throw new TypeError('Route parameter names must be unique.');

    const normalizedMethod = method.toUpperCase();
    if (routes.some(route => route.method === normalizedMethod && route.path === path)) {
      throw new TypeError(`A route is already registered for ${normalizedMethod} ${path}.`);
    }
    routes.push({ method: normalizedMethod, path, segments, handler });
    return router;
  }

  function match(method, pathname) {
    if (typeof method !== 'string' || typeof pathname !== 'string') return null;
    let segments;
    try {
      segments = routeSegments(pathname);
    } catch {
      return null;
    }

    for (const route of routes) {
      if (route.method !== method.toUpperCase() || route.segments.length !== segments.length) continue;
      const params = {};
      let matched = true;

      for (let index = 0; index < segments.length; index += 1) {
        const expected = route.segments[index];
        let actual;
        try {
          actual = decodeURIComponent(segments[index]);
        } catch {
          matched = false;
          break;
        }

        if (expected.startsWith(':')) params[expected.slice(1)] = actual;
        else if (expected !== actual) {
          matched = false;
          break;
        }
      }

      if (matched) return { handler: route.handler, params };
    }
    return null;
  }

  const router = { add, match };
  return router;
}
