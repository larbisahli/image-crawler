## Usage with Next.js

image-crawler will download an image using a URL or Data URL and upload it to a
s3 bucket with a 16px placeholder version of the original image for the Nextjs
image component placeholder.

Download and upload an image using a url:

```javascript
// server.js

import UploadImageByUrl from './src/upload';

const PrintResults = async () => {
  const url = 'https://ae01.alicdn.com/kf/HTB13gJEKeGSBuNjSspbq6AiipXaM.jpg';
  const title = 'product image from ali express';

  const { image, placeholder, error } = await UploadImageByUrl(
    url,
    title
  );
};

PrintResults();

// Print Results:
{
  image: {
    path: '/2021/7/product_image_from_ali_express_1625320790_utZlhTnHo.jpg',
    ETag: '"fa8bc66b3d45370d5997856fb07cef07"'
  },
  placeholder: {
    path: '/2021/7/product_image_from_ali_express_1625320790_utZlhTnHo_placeholder.jpg',
    ETag: '"22436eaa7cd6c1b0ee25ec171265dcbc"'
  },
  error: undefined
}
```

Using the placeholder in Nextjs Image component:

```javascript
// component.js

import React from 'react';
import Image from 'next/image';

const component = () => {
  // Show something while the placeholder is loading
  const [Base64Placeholder, setBase64Placeholder] = useState(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mM8eftXPQAIMgMfS5tX7gAAAABJRU5ErkJggg=='
  );

  const placeholderUrl =
    'https://bucket-name.fra1.digitaloceanspaces.com/2021/7/product_image_from_ali_express_1625320790_utZlhTnHo_placeholder.jpg';

  useEffect(() => {
    // Convert an Image URL to DataUrl (base64)
    async function toBase64() {
      const data = await fetch(placeholderUrl);
      const blob = await data.blob();

      return await new Promise((resolve) => {
        const reader = new window.FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result;
          return resolve(base64data);
        };
      }).then((res) => {
        setBase64Placeholder(res);
      });
    }

    if (placeholderUrl) toBase64();
  }, [placeholderUrl]);

  return (
    <Image
      quality={95}
      width={250}
      height={250}
      blurDataURL={Base64Placeholder}
      placeholder="blur"
      alt="my product image"
      className="bg-blue-100 rounded-t"
      unoptimized={true} // Use unoptimized=true or upgrade Next.js to V11.1.0 for the fix of image content type octet-stream 400
      src="https://bucket-name.fra1.digitaloceanspaces.com/2021/7/product_image_from_ali_express_1625320790_utZlhTnHo.jpg"
    />
  );
};
```

First, install all dependencies for the project:

```bash
yarn install
```

Second, run the development server:

```bash
yarn dev
```
