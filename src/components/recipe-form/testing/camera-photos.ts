// A photo as a camera saves one, drawn at its size.
export function cameraPhoto(name: string, size: { width: number; height: number }): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob === null
					? reject(new Error('The canvas drew no photo.'))
					: resolve(new File([blob], name, { type: 'image/jpeg' })),
			'image/jpeg'
		);
	});
}
