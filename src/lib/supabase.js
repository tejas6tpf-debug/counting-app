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
            .order('id', { ascending: true }) // Stable sort for pagination
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

/**
 * Helper to fetch data for a large list of IDs/PartNumbers in chunks.
 * Solves the URL length limit / query limit issue with .in() filters.
 * @param {string} tableName - Table to fetch from.
 * @param {string[]} values - Array of values to match (e.g. part numbers).
 * @param {string} column - Column to match against (default: 'part_number').
 */
export const fetchByPartNumbers = async (tableName, values, column = 'part_number', selectQuery = '*') => {
    if (!values || values.length === 0) return [];

    const uniqueValues = [...new Set(values)];
    let allData = [];
    const chunkSize = 200; // Safe limit for .in() queries

    for (let i = 0; i < uniqueValues.length; i += chunkSize) {
        const chunk = uniqueValues.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from(tableName)
            .select(selectQuery)
            .in(column, chunk);

        if (error) {
            console.error(`Error fetching chunk from ${tableName}:`, error);
            // We continue trying other chunks instead of throwing immediately
        } else if (data) {
            allData = [...allData, ...data];
        }
    }

    return allData;
};
