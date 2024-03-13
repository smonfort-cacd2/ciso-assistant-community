import { LoginPage } from '../utils/login-page.js';
import { SideBar } from '../utils/sidebar.js';
import { test, expect, setHttpResponsesListener, TestContent } from '../utils/test-utils.js';
import testData from '../utils/test-data.js';

const userGroups: {string: any} = testData.usergroups;

Object.entries(userGroups).forEach(([userGroup, userGroupData]) => {
    let doCleanup = false;
    test.describe(`${userGroupData.name} user has the right permissions`, async () => {
        test.describe.configure({mode: 'serial'});
        
        let vars = TestContent.generateTestVars();
        let testObjectsData: { [k: string]: any } = TestContent.itemBuilder(vars);
        
        test.beforeEach(async ({page}) => {
            setHttpResponsesListener(page);
        });
        
        test('user can set his password', async ({
            logedPage,
            usersPage,
            foldersPage,
            sideBar,
            mailer,
            page
        }) => {
            await foldersPage.goto();
            await foldersPage.createItem({
                name: vars.folderName,
                description: vars.description
            });
        
            await usersPage.goto();
            await usersPage.createItem({
                email: vars.user.email
            });
        
            await usersPage.editItemButton(vars.user.email).click();
            await usersPage.form.fill({
                first_name: vars.user.firstName,
                last_name: vars.user.lastName, 
                user_groups: [
                    `${vars.folderName} - ${userGroupData.name}`
                ],
            });
            await usersPage.form.saveButton.click();
            await usersPage.isToastVisible('.+ successfully saved: ' + vars.user.email);
        
            await sideBar.logout();
        
            await expect(mailer.page.getByText('{{').last()).toBeHidden(); // Wait for mailhog to load the emails
            const lastMail = await mailer.getLastEmail();
            await lastMail.hasWelcomeEmailDetails();
            await lastMail.hasEmailRecipient(vars.user.email);
            
            await lastMail.open();
            const pagePromise = page.context().waitForEvent('page');
            await mailer.emailContent.setPasswordButton.click();
            const setPasswordPage = await pagePromise;
            await setPasswordPage.waitForLoadState();
            await expect(setPasswordPage).toHaveURL(await mailer.emailContent.setPasswordButton.getAttribute('href') || 'Set password link could not be found');
        
            const setLoginPage = new LoginPage(setPasswordPage);
            await setLoginPage.newPasswordInput.fill(vars.user.password);
            await setLoginPage.confirmPasswordInput.fill(vars.user.password);
            await setLoginPage.setPasswordButton.click();
            
            await setLoginPage.isToastVisible('Your password was successfully set. Welcome to CISO Assistant.');
        
            await setLoginPage.login(vars.user.email, vars.user.password);
            await expect(setLoginPage.page).toHaveURL('/analytics');
        
            // logout to prevent sessions conflicts
            const passwordPageSideBar = new SideBar(setPasswordPage);
            await passwordPageSideBar.logout();
        });

        test.describe(() => {
            test.beforeEach(async ({loginPage, page}) => {
                await loginPage.goto();
                await loginPage.login(vars.user.email, vars.user.password);
                await expect(page).toHaveURL('/analytics');
            });

            test('user can view his folder', async ({foldersPage, page}) => {
                await foldersPage.goto();
                await expect(foldersPage.getRow(vars.folderName)).toBeVisible();
            });
    
            Object.entries(testObjectsData).forEach(([objectPage, objectData], index) => {
                test(`user can view ${objectData.displayName.toLowerCase()}`, async ({pages, page}) => {
                    await pages[objectPage].goto();
                    await page.waitForTimeout(100);
                    // ...

                    if (index === Object.keys(testObjectsData).length - 1) {
                        doCleanup = true;
                    }
                });
            });
        });
        
        test.afterEach('cleanup', async ({sideBar, loginPage, foldersPage, usersPage, page}) => {
            // make sure to execute the cleanup only after the last test
            if (doCleanup) {
                console.log('Cleanup');
                
                // logout if the user is still logged in
                if (await sideBar.userEmailDisplay.innerText() === vars.user.email) {
                    await sideBar.logout();
                }
        
                await loginPage.login();
                await foldersPage.goto();
                await foldersPage.deleteItemButton(vars.folderName).click();
                await foldersPage.deleteModalConfirmButton.click();
                await expect(foldersPage.getRow(vars.folderName)).not.toBeVisible();
                await usersPage.goto();
                await usersPage.deleteItemButton(vars.user.email).click();
                await usersPage.deleteModalConfirmButton.click();
                await expect(usersPage.getRow(vars.user.email)).not.toBeVisible();
            }
        });
    });
});
