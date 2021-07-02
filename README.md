## Usage with Next.js

image-crawler will download an image using the URL or DataUrl and then upload
the image and a 16px placeholder for Nextjs image component to s3 bucket.

```javascript
// server.js

import UploadImageByUrl from './src/UploadByUrl';

const PrintResults = async () => {
  const url = 'https://ae01.alicdn.com/kf/HTB13gJEKeGSBuNjSspbq6AiipXaM.jpg';
  const title = 'product image from ali express';

  const { success, error, image, placeholder } = await UploadImageByUrl(
    url,
    title
  );
};

PrintResults();

// Results:
//   {
//     success: undefined,
//     error: undefined,
//     image: {
//       path: 'temp\\product_image_from_ali_express_1625214253_McTefiJPA.jpg',
//       ETag: '"fa8bc66b3d45370d5997856fb07cef07"'
//     },
//     placeholder: {
//       path: 'temp\\product_image_from_ali_express_1625214253_McTefiJPA_placeholder.jpg',
//       ETag: '"22436eaa7cd6c1b0ee25ec171265dcbc"'
//   }
```

How to use the placeholder in Nextjs Image component

```javascript
// component.js

import React from 'react';
import Image from 'next/image';

const component = () => {
  // Show something while the placeholder is loading
  const [Base64Placeholder, setBase64Placeholder] = useState(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mM8eftXPQAIMgMfS5tX7gAAAABJRU5ErkJggg=='
  );

  useEffect(() => {
    // Convert an Image to DataUrl
    async function fetchData() {
      const data = await fetch(url);
      const blob = await data.blob();
      // eslint-disable-next-line no-undef
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

    if (url) fetchData();
  }, [url]);

  return (
    <Image
      quality={95}
      width={250}
      height={250}
      blurDataURL={Base64Placeholder}
      placeholder="blur"
      alt=""
      className="bg-blue-100 rounded-t"
      unoptimized={true} // use this untill next.js V11.0.2 is released
      src="https://bucket-name.fra1.digitaloceanspaces.com/2021/7/product_image_from_ali_express_1625219873_Dpse5Mot9.jpg"
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
