import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing! Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key')

/**
 * Helper to fetch ALL records from a table, bypassing the 1000-row limit.
 * @param {string} tableName - The name of the table to fetch from.
 * @param {string} selectQuery - The columns to select (default: '*').
 * @param {object} filter - Optional filter object (e.g., { column: 'is_active', value: true }).
 * @param {string} orderBy - Column to order by (default: 'created_at').
 * @param {boolean} ascending - Sort order (default: false).
 */
export const fetchAllRecords = async (tableName, selectQuery = '*', filter = null, orderBy = 'created_at', ascending = false) => {
    let allData = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        let query = supabase
            .from(tableName)
            .select(selectQuery)
            .order(orderBy, { ascending })
            .range(from, from + step - 1);

        if (filter) {
            query = query.eq(filter.column, filter.value);
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            throw error;
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += step;
            if (data.length < step) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    return allData;
};
