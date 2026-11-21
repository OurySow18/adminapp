# Admin Monmarché

> ## ⚠️ Dépôt remplacé par le monorepo monmarche-shared
>
> Depuis le 21/11/2026, **tout le code de l'admin est dans `monmarche-shared/apps/admin`**, avec l'historique Git de ce dépôt. L'admin (site `monmarhe.web.app`) est compilé et publié uniquement depuis le monorepo :
>
> ```powershell
> cd monmarche-shared
> firebase deploy --only hosting:admin
> ```
>
> Ne plus modifier ni déployer ce dépôt. `firebase.json` et `.firebaserc` en ont été retirés pour qu'aucun déploiement ne puisse en partir. Voir `monmarche-shared/docs/migration-monorepo.md`.

## Règles et index Firestore : déplacés

Depuis le 21/11/2026, les règles Firestore, les index et les règles Storage du projet `monmarhe` sont dans le monorepo **monmarche-shared**, dossier `firebase/`. Ils sont déployés uniquement depuis là-bas :

```powershell
cd monmarche-shared/firebase
firebase deploy --only firestore,storage
```

Ne plus recréer `firestore.rules` ni `firestore.indexes.json` ici. Voir `monmarche-shared/docs/migration-monorepo.md`.

## Cloud Functions : déplacées

Depuis le 21/11/2026, les Cloud Functions de l'admin (codebase `admin` : paiements vendeurs, avis, notifications, optimisation d'images…) sont dans **monmarche-shared**, dossier `firebase/functions/admin/`, avec leur historique Git. Elles sont déployées uniquement depuis là-bas : `firebase deploy --only functions:admin`. Ne plus recréer de dossier `functions/` ici.

L'hébergement de l'admin est lui aussi déployé depuis le monorepo depuis le 21/11/2026 (voir plus haut).

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
