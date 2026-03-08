export type ApiEnvelope<T> = {
    codigo: number;
    mensaje: string;
    data: T;
};

export function unwrapOrThrow<T>(resp: ApiEnvelope<T>): T {
    if (!resp) throw new Error('Respuesta vacía del servidor');
    if (resp.codigo !== 0) throw new Error(resp.mensaje || 'Error desconocido');
    return resp.data;
}

export function unwrapWithMsg<T>(resp: ApiEnvelope<T>): { data: T; mensaje: string } {
    const data = unwrapOrThrow<T>(resp);
    return { data, mensaje: resp?.mensaje || '' };
}
