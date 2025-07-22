
const WORKER_URL = '/worker-data';


const cardContainer = document.getElementById('card-container');
const lastSearchedCardContainer = document.getElementById('last-searched-card-container'); // 新しい表示エリア

        // 結果を表示する関数 (targetContainerを引数に追加)
        function displayResults(data, targetContainer) {
            targetContainer.innerHTML = ''; // 指定されたコンテナをクリア
            const rawDataDisplay = document.getElementById('raw-data-display');
            rawDataDisplay.textContent = JSON.stringify(data, null, 2); // 生データを表示
            rawDataDisplay.style.display = 'block'; // 生データの表示を有効に
            console.log('Received data:', rawDataDisplay.textContent); // コンソールにデータを表示


            const items = data.data; // 実際のデータ配列を参照

            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('financial-card'); // 新しいクラスを追加

                const code = item.code || 'Code not found';
                const heading = document.createElement('h4');
                heading.textContent = item.name || `Code: ${code}`; // nameがあればnameを、なければcodeを表示
                itemDiv.appendChild(heading);

                // 既存のpreタグの代わりに、詳細情報を表示するdivを作成
                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('card-details'); // スタイリング用のクラスを追加

                let cardContent = '';
                if (item.name === '米ドル/円') {
                    // 米ドル/円の場合のフォーマット
                    cardContent = `
                        <p><strong>Bid値:</strong> ${item.bid_value || 'N/A'}</p>
                        <p><strong>更新日時:</strong> ${item.update_time || 'N/A'}</p>
                    `;
                } else {
                    // その他の場合のフォーマット
                    const value = item.current_value || item.bid_value || 'N/A';
                    const change = item.previous_day_change ? `${item.previous_day_change} (${item.change_rate}%)` : 'N/A';
                    const updateTime = item.update_time || 'Update time not found';

                    cardContent = `
                        <p><strong>現在値:</strong> ${value}</p>
                        <p><strong>前日比:</strong> ${change}</p>
                        <p><strong>更新日時:</strong> ${updateTime}</p>
                    `;
                }

                detailsDiv.innerHTML = cardContent;
                itemDiv.appendChild(detailsDiv);

                targetContainer.appendChild(itemDiv);
            });
        }

        // デフォルト指標を取得して表示
        async function fetchDefaultQuotes() {
            cardContainer.textContent = 'デフォルト指標を取得中...'; // ここも変更
            try {
                const response = await fetch(WORKER_URL + '?codes=USDJPY=FX,%5EDJI,998407'); // 複数のデフォルトコードを付与
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`サーバーエラー: ${response.status} ${response.statusText} - ${errorText}`);
                }
                const result = await response.json(); // Pages Functionからのラップされたレスポンス
                if (result.status === 'success') {
                    displayResults(result.data, cardContainer); // cardContainerに表示
                } else {
                    cardContainer.textContent = `APIエラー: ${result.message}`;
                }
            } catch (error) {
                cardContainer.textContent = `エラー: ${error.message}`;
            }
        }

        // 個別コード検索のイベントリスナー
        document.getElementById('code-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const code = document.getElementById('code-input').value;
            localStorage.setItem('lastSearchedCode', code); // ローカルストレージに保存

            // 新しい表示エリアに検索中メッセージを表示
            lastSearchedCardContainer.innerHTML = '';
            lastSearchedCardContainer.textContent = `'${code}'を検索中...`;

            try {
                // GETリクエストでクエリパラメータとしてコードを渡す
                const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(code)}`);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`サーバーエラー: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const result = await response.json(); // Pages Functionからのラップされたレスポンス
                if (result.status === 'success') {
                    displayResults(result.data, lastSearchedCardContainer); // lastSearchedCardContainerに表示
                } else {
                    lastSearchedCardContainer.textContent = `APIエラー: ${result.message}`;
                }
            } catch (error) {
                lastSearchedCardContainer.textContent = `エラー: ${error.message}`;
            }
        });

        // ページ読み込み時にデフォルト指標とローカルストレージのコードを取得
        window.addEventListener('load', async () => {
            await fetchDefaultQuotes(); // 常にデフォルト指標を取得

            const lastSearchedCode = localStorage.getItem('lastSearchedCode');
            if (lastSearchedCode) {
                document.getElementById('code-input').value = lastSearchedCode;
                // 最後に検索したコードがあれば、それを新しい表示エリアに表示
                lastSearchedCardContainer.innerHTML = ''; // 既存のメッセージをクリア
                lastSearchedCardContainer.textContent = `'${lastSearchedCode}'を検索中...`;
                try {
                    const response = await fetch(`${WORKER_URL}?codes=${encodeURIComponent(lastSearchedCode)}`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`サーバーエラー: ${response.status} ${response.statusText} - ${errorText}`);
                    }
                    const result = await response.json();
                    if (result.status === 'success') {
                        displayResults(result.data, lastSearchedCardContainer);
                    } else {
                        lastSearchedCardContainer.textContent = `APIエラー: ${result.message}`;
                    }
                } catch (error) {
                    lastSearchedCardContainer.textContent = `エラー: ${error.message}`;
                }
            }
        });